import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a Base64 string suitable for the API.
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Sends the invoice image to Gemini to extract product data and supplier info.
 */
export const parseInvoiceImage = async (base64Image: string): Promise<InvoiceData> => {
  const model = "gemini-2.5-flash"; 

  const prompt = `
    Actúa como un experto contable verificando facturas en Venezuela. Tu objetivo es extraer datos con precisión quirúrgica y CLASIFICAR la mercancía.

    --- IMPORTANTE: DETECCIÓN DE MONEDA (CONTEXTO VENEZOLANO) ---
    1. ANALIZA LA MAGNITUD DE LOS PRECIOS:
       - Si ves precios como "500.00", "1200.00", "3500.00" para productos de consumo masivo (harina, refresco), LA MONEDA ES BOLÍVARES (Bs), incluso si el ticket imprime el símbolo "$".
       - En Venezuela, muchas impresoras fiscales viejas usan "$" por defecto aunque cobren en Bolívares.
       - Solo asume USD si los precios son bajos (ej: 1.50, 20.00, 5.00).
    2. BUSCA SIGLAS: "VES", "Bs", "Bs.D", "USD", "Ref".
    3. REGLA DE ORO: Si hay duda, mira el "Total a Pagar". Si es > 1000 y es comida/básicos, son BOLÍVARES.

    --- TAREA DE EXTRACCIÓN Y DESGLOSE ---
    
    A. PROVEEDOR:
       - Nombre legal o comercial.
       - RIF (J-xxxxxxxx-x).

    B. PRODUCTOS (Matemática y Lógica):
       - Extrae el **PRECIO UNITARIO**. 
       - DETECCIÓN DE EMPAQUES (PackSize): "x12", "x24", "Bulto".
       - Si no hay multiplicador explícito, Quantity = Cantidad Factura.

    C. CATEGORIZACIÓN (El Desglose):
       - Clasifica CADA producto en una de estas categorías:
         * "Alimentos" (Harina, Pasta, Arroz, Aceite, Salsas)
         * "Bebidas" (Refrescos, Jugos, Agua)
         * "Licores" (Cerveza, Ron, Vino)
         * "Limpieza" (Detergente, Cloro, Desinfectante)
         * "Higiene" (Jabón, Shampoo, Papel Higiénico)
         * "Charcutería" (Queso, Jamón)
         * "Snacks" (Pepito, Doritos, Galletas)
         * "Otros" (Cualquier otra cosa)

    D. NOMBRE DEL PRODUCTO:
       - Normaliza nombres cortados. "H. PAN" -> "Harina Pan".

    Responde ESTRICTAMENTE en JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", 
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            currency: { 
                type: Type.STRING, 
                enum: ["USD", "Bs"], 
                description: "Moneda detectada basada en la magnitud de los números. Si los precios son >100 para items simples, es Bs." 
            },
            supplier: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nombre legal o comercial del proveedor" },
                rif: { type: Type.STRING, description: "RIF, NIT o número fiscal" }
              },
              required: ["name", "rif"]
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  rawProductName: { type: Type.STRING, description: "Nombre exacto como aparece en OCR" },
                  quantity: { type: Type.NUMBER, description: "La cantidad TOTAL en unidades (Original * PackSize)" },
                  originalQuantity: { type: Type.NUMBER, description: "La cantidad escrita en la factura" },
                  detectedPackSize: { type: Type.NUMBER, description: "El multiplicador detectado (1 si es unidad)" },
                  price: { type: Type.NUMBER, description: "Precio UNITARIO en la moneda detectada (No el total de la línea)" },
                  category: { type: Type.STRING, description: "Categoría detectada: Alimentos, Bebidas, Limpieza, etc." },
                },
                required: ["productName", "quantity", "price", "category"],
              },
            }
          },
          required: ["supplier", "items", "currency"]
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return { items: [], supplier: { name: "Desconocido", rif: "N/A" }, currency: "Bs" };
    
    // Clean potential markdown code blocks
    const cleanedJson = jsonText.replace(/```json|```/g, '').trim();
    
    const data = JSON.parse(cleanedJson) as InvoiceData;
    return data;
  } catch (error) {
    console.error("Error parsing invoice with Gemini:", error);
    throw new Error("No se pudo procesar la factura. Intenta con una imagen más clara.");
  }
};