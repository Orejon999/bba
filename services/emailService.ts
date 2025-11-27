import { Product } from '../types';
import { supabase } from './supabaseClient';

export const EmailService = {
  /**
   * Checks for low stock products and sends an email notification.
   * Currently simulates the email sending via console and assumes a potential Supabase Edge Function.
   */
  sendLowStockAlert: async (userEmail: string, lowStockProducts: Product[]): Promise<boolean> => {
    if (lowStockProducts.length === 0) return false;

    console.log(`[EmailService] Preparing to send low stock alert to ${userEmail}...`);

    const subject = `⚠️ Alerta de Stock Bajo: ${lowStockProducts.length} productos`;
    
    // Create text body
    const itemsList = lowStockProducts.map(p => 
      `• ${p.name}: ${p.quantity} unid. (Mín: ${p.minStock})`
    ).join('\n');

    const body = `
Hola,

El sistema de inventario ha detectado que los siguientes productos están por debajo del nivel mínimo de stock:

${itemsList}

Por favor, gestiona la reposición lo antes posible.

Atentamente,
BBC Inventario IA
    `.trim();

    // 1. Simulation (Always works for demo purposes)
    console.group('📧 MOCK EMAIL SENT');
    console.log(`To: ${userEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.groupEnd();

    // 2. Real Implementation (Ready for Supabase Edge Functions)
    /*
    const { error } = await supabase.functions.invoke('send-email', {
      body: { 
        to: userEmail, 
        subject: subject, 
        text: body 
      }
    });

    if (error) {
      console.error('Failed to send email via Supabase:', error);
      return false;
    }
    */

    return true;
  }
};
