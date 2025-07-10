import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'general', country = 'us', pageSize = 20 } = await req.json()
    
    const apiKey = Deno.env.get('NEWSAPI_KEY')
    if (!apiKey) {
      throw new Error('NewsAPI key not configured')
    }

    // Construct NewsAPI URL
    const url = new URL('https://newsapi.org/v2/top-headlines')
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('country', country)
    url.searchParams.set('pageSize', pageSize.toString())
    
    if (category && category !== 'general') {
      url.searchParams.set('category', category)
    }

    console.log('Fetching news from:', url.toString().replace(apiKey, '[REDACTED]'))

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.status !== 'ok') {
      throw new Error(`NewsAPI error: ${data.message}`)
    }

    // Transform the articles to match our NewsArticle interface
    const transformedArticles = data.articles.map((article: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      title: article.title || 'Untitled',
      summary: article.description || '',
      content: article.content || article.description || '',
      image: article.urlToImage || '/placeholder.svg',
      source: article.source?.name || 'Unknown Source',
      category: category,
      publishedAt: article.publishedAt || new Date().toISOString(),
      readTime: `${Math.ceil((article.content?.length || 500) / 200)} min read`
    }))

    console.log(`Successfully fetched ${transformedArticles.length} articles`)

    return new Response(
      JSON.stringify({ 
        articles: transformedArticles,
        totalResults: data.totalResults 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error fetching news:', error)
    
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