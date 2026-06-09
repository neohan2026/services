// Netlify Function: ASIN API Proxy
// Calls Rainforest API and returns normalized data
const RAINFOREST_API_BASE = "https://api.rainforestapi.com/request";

function estimateMonthlySales(bsr) {
  if (bsr === null || bsr === undefined) return null;
  if (bsr <= 100) return Math.round(1000 + Math.random() * 2000);
  if (bsr <= 500) return Math.round(500 + Math.random() * 500);
  if (bsr <= 1000) return Math.round(300 + Math.random() * 200);
  if (bsr <= 3000) return Math.round(150 + Math.random() * 150);
  if (bsr <= 5000) return Math.round(80 + Math.random() * 70);
  if (bsr <= 10000) return Math.round(40 + Math.random() * 40);
  if (bsr <= 20000) return Math.round(20 + Math.random() * 20);
  if (bsr <= 50000) return Math.round(10 + Math.random() * 10);
  if (bsr <= 100000) return Math.round(5 + Math.random() * 5);
  return Math.round(1 + Math.random() * 4);
}

function estimateFbaFee(price) {
  if (!price) return null;
  if (price < 10) return 3.5;
  if (price < 25) return 4.5;
  if (price < 50) return 5.5;
  if (price < 100) return 6.5;
  return 7.5 + (price - 100) * 0.05;
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const asin = params.asin;
  const domain = params.domain || "amazon.com";
  const apiKey = process.env.RAINFOREST_API_KEY;

  if (!asin) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "ASIN is required" }),
    };
  }

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "RAINFOREST_API_KEY not configured" }),
    };
  }

  try {
    const url = `${RAINFOREST_API_BASE}?api_key=${encodeURIComponent(apiKey)}&type=product&amazon_domain=${encodeURIComponent(domain)}&asin=${encodeURIComponent(asin)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: `Rainforest API error: ${response.status}` }),
      };
    }

    const data = await response.json();
    const product = data.product || {};
    const pricing = product.pricing_summary || {};
    const bsrData = product.buy_box_winner?.sales_rank || product.bestsellers_rank || {};

    const bsr =
      bsrData.rank ??
      (Array.isArray(product.bestsellers_ranks) ? product.bestsellers_ranks[0]?.rank : null);

    const bsrCategory =
      bsrData.category ??
      (Array.isArray(product.bestsellers_ranks) ? product.bestsellers_ranks[0]?.category : null);

    const currentPrice =
      pricing?.buybox_winner?.price ??
      product.buy_box_winner?.price ??
      pricing?.list_price?.value ??
      product.prices?.[0]?.value ??
      null;

    const monthlySales = estimateMonthlySales(bsr);

    const result = {
      success: true,
      data: {
        asin,
        title: product.title || "",
        brand: product.brand || "",
        mainImage: product.main_image?.link || product.images?.[0]?.link || "",
        rating: product.rating ?? null,
        ratingsCount: product.ratings_total ?? null,
        currentPrice,
        originalPrice: pricing?.list_price?.value ?? null,
        currency: pricing?.buybox_winner?.currency || pricing?.list_price?.currency || "USD",
        prime: product.buy_box_winner?.is_prime ?? false,
        bsr,
        bsrCategory,
        monthlySalesEstimate: monthlySales,
        monthlyRevenueEstimate: monthlySales && currentPrice ? Math.round(monthlySales * currentPrice) : null,
        estimatedFbaFee: estimateFbaFee(currentPrice),
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Failed to fetch product data" }),
    };
  }
};
