import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'news', pageSize = 20 } = await req.json()
    
    const apiKey = Deno.env.get('PA_MEDIA_API_KEY')
    if (!apiKey) {
      throw new Error('PA Media API key not configured')
    }

    // Map our categories to PA Media's Ready categories
    const categoryMapping: { [key: string]: string } = {
      'all': 'news',
      'general': 'news',
      'business': 'business',
      'sport': 'sport',
      'politics': 'news', // Politics stories are usually in news
      'technology': 'news',
      'entertainment': 'entertainment',
      'lifestyle': 'real-life'
    }

    const paMediaCategory = categoryMapping[category] || 'news'
    
    // Construct PA Media API URL - using correct endpoint from documentation
    const baseUrl = 'https://content.api.pressassociation.io/v1'
    const url = new URL(baseUrl)
    url.searchParams.set('format', 'json')
    url.searchParams.set('size', pageSize.toString())
    url.searchParams.set('sort', 'published:desc')
    
    // Add category filter if not 'all'
    if (category !== 'all') {
      url.searchParams.set('categories', paMediaCategory)
    }

    console.log('Fetching PA Media content from:', url.toString())

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NewsApp/1.0',
        'apikey': apiKey  // Using correct authentication method from PA Media docs
      }
    })
    
    if (!response.ok) {
      throw new Error(`PA Media API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Transform the articles to match our NewsArticle interface
    const transformedArticles = data.items?.map((item: any, index: number) => ({
      id: `pa-${item.id || Date.now()}-${index}`,
      title: item.headline || item.title || 'Untitled',
      summary: item.description || item.summary || '',
      content: item.body_text || item.content || item.description || '',
      image: item.renditions?.[0]?.href || item.image_url || '/placeholder.svg',
      source: 'PA Media',
      category: category,
      publishedAt: item.published || item.created_date || new Date().toISOString(),
      readTime: `${Math.ceil((item.body_text?.length || 500) / 200)} min read`
    })) || []

    console.log(`Successfully fetched ${transformedArticles.length} PA Media articles`)

    return new Response(
      JSON.stringify({ 
        articles: transformedArticles,
        totalResults: data.total || transformedArticles.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error fetching PA Media content:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        articles: [],
        totalResults: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})