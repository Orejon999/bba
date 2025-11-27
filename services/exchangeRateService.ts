export interface ExchangeRates {
  bcv: number;
  parallel: number;
  lastUpdate: string;
}

export const ExchangeRateService = {
  getRates: async (): Promise<ExchangeRates | null> => {
    try {
      // Cambio a ve.dolarapi.com que tiene mejor soporte CORS para frontend y es más estable
      const response = await fetch('https://ve.dolarapi.com/v1/dolares');
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      
      // La API retorna un array de monitores. Buscamos por código 'oficial' (BCV) y 'paralelo'.
      // Estructura típica: { codigo: "oficial", nombre: "Oficial", promedio: 36.5, ... }
      const bcvRate = data.find((d: any) => d.codigo === 'oficial' || d.nombre === 'Oficial')?.promedio || 0;
      const parallelRate = data.find((d: any) => d.codigo === 'paralelo' || d.nombre === 'Paralelo')?.promedio || 0;
      
      return {
        bcv: bcvRate,
        parallel: parallelRate,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      // Retornamos null para manejar el error silenciosamente en la UI
      return null;
    }
  }
};