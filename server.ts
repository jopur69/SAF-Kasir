import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy-initialized server-side Gemini client
let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for AI assistant
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, context } = req.body;

      const systemInstruction = `Anda adalah asisten AI pintar yang ramah dan berjiwa wirausaha khusus untuk mengelola kasir sembako bernama "Asisten SAF Kasir".
Tugas Anda adalah membantu pemilik kasir sembako (seperti Toko Kelontong lokal di Indonesia) dalam menganalisis penjualan, memperkirakan stok barang, memberikan strategi menagih hutang yang sopan, menghitung profitabilitas, serta memberikan ide-ide taktis untuk meningkatkan omset kasir mereka.

Gunakan bahasa Indonesia yang santun, ramah, dan bersahabat. Gunakan panggilan lokal seperti Bapak, Ibu, Kak, atau Juragan.

Berikut adalah data kondisi SAF Kasir saat ini:
- Total Stok Barang: ${context?.products?.length || 0} jenis barang
- Barang dengan Stok Menipis: ${context?.lowStockCount || 0} bahan pokok
- Jumlah Riwayat Transaksi Penjualan: ${context?.transactions?.length || 0} transaksi
- Total Piutang Di Buku Utang: Rp ${(context?.totalDebtAmount || 0).toLocaleString('id-ID')} (berasal dari ${context?.debts?.length || 0} orang)

Detail Barang dengan Stok Menipis:
${(context?.lowStockProducts || []).map((p: any) => `- ${p.name} (Sisa stok: ${p.stock} ${p.unit}, Batas minimal: ${p.minStock})`).join("\n") || "Semua barang dalam kondisi aman/cukup."}

Detail Pelanggan Buku Utang:
${(context?.debts || []).map((d: any) => `- ${d.customerName} (Sisa utang: Rp ${d.remainingDebt.toLocaleString('id-ID')}, Keperluan: ${d.notes})`).join("\n") || "Tidak ada sisa piutang, semua lunas!"}

Ketika pemilik bertanya, berikan analisis taktis berdasarkan data di atas. Jika mereka minta draf chat WhatsApp untuk menagih hutang, buatkan draf pesan yang SANGAT sopan agar hubungan baik tetangga tetap terjaga, namun tetap tegas menagih utang secara halus sesuai dengan nama orang dan nominalnya.`;

      // Build historical prompt format safely
      let prompt = "";
      if (history && history.length > 0) {
        history.forEach((h: any) => {
          prompt += `${h.role === 'user' ? 'Pemilik' : 'Asisten'}: ${h.text}\n`;
        });
      }
      prompt += `Pemilik: ${message}\nAsisten:`;

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Terjadi kesalahan pada server AI." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server with Vite playing on http://localhost:${PORT}`);
  });
}

startServer();
