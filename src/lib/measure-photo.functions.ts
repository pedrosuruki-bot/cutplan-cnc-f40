import { createServerFn } from "@tanstack/react-start";

export interface ScannedPart {
  length: number;
  width: number;
  quantity: number;
  name?: string;
}

const MAX_DIMENSION_MM = 10000;
const MAX_QUANTITY = 10000;
const MAX_PARTS = 500;
const MAX_IMAGE_CHARS = 8_000_000;
const recentRequests = new Map<string, number>();

const SYSTEM = `És um assistente de marcenaria. Recebes a foto de uma folha de papel com medidas de peças a cortar.
Devolve APENAS JSON válido no formato {"parts":[{"length":800,"width":400,"quantity":2,"name":"lateral"}]}.
Regras: length = maior medida (comprimento) em milímetros, width = a outra medida em milímetros.
Assume milímetros quando a folha não indicar unidade. Se uma dimensão vier como decimal (ex: 27.5), NÃO a transformes em 275 sem evidência de unidade; mantém 27.5 mm. Se a folha disser cm ou m, converte explicitamente para mm.
quantity é 1 quando não houver indicação (ex: "x2", "2un", "2 pcs" => 2).
name é opcional e curto. Ignora texto que não seja medidas.`;

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export const scanMeasurementsPhoto = createServerFn({ method: "POST" })
  .validator((input: { imageDataUrl: string }) => {
    if (
      !input ||
      typeof input.imageDataUrl !== "string" ||
      !input.imageDataUrl.startsWith("data:image/")
    ) {
      throw new Error("Imagem inválida");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ parts: ScannedPart[] }> => {
    if (data.imageDataUrl.length > MAX_IMAGE_CHARS)
      throw new Error("Imagem demasiado grande. Tira uma foto mais simples.");
    const comma = data.imageDataUrl.indexOf(",");
    const header = comma > 0 ? data.imageDataUrl.slice(0, comma).toLowerCase() : "";
    if (!/^data:image\/(jpeg|jpg|png|webp);base64$/.test(header))
      throw new Error("Formato de imagem não suportado.");
    const requestKey = "global";
    const now = Date.now();
    const previous = recentRequests.get(requestKey) ?? 0;
    if (now - previous < 5000) throw new Error("Espera alguns segundos antes de ler outra foto.");
    recentRequests.set(requestKey, now);
    for (const [k, t] of recentRequests) if (now - t > 60_000) recentRequests.delete(k);

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Serviço de leitura de fotos indisponível");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrai as medidas das peças desta folha." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Demasiados pedidos seguidos. Tenta daqui a pouco.");
    if (res.status === 402) throw new Error("Sem créditos para ler a foto. Adiciona créditos.");
    if (!res.ok) throw new Error(`Não foi possível ler a foto (${res.status})`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { parts?: unknown };
    try {
      parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as { parts?: unknown };
    } catch {
      throw new Error("Não consegui perceber as medidas da foto");
    }

    const parts: ScannedPart[] = (
      Array.isArray(parsed.parts) ? parsed.parts.slice(0, MAX_PARTS) : []
    )
      .map((raw) => {
        const p = raw as Record<string, unknown>;
        const a = Math.round(toNumber(p["length"]));
        const b = Math.round(toNumber(p["width"]));
        const q = Math.min(MAX_QUANTITY, Math.max(1, Math.round(toNumber(p["quantity"]) || 1)));
        const name = typeof p["name"] === "string" ? p["name"].slice(0, 40) : undefined;
        return {
          length: Math.min(MAX_DIMENSION_MM, Math.max(a, b)),
          width: Math.min(MAX_DIMENSION_MM, Math.min(a, b)),
          quantity: q,
          ...(name ? { name } : {}),
        };
      })
      .filter((p) => p.length > 0 && p.width > 0);

    return { parts };
  });
