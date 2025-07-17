import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'general', country = 'us', pageSize = 20, source = 'newsapi' } = await req.json()
    
    // Handle PA Media source
    if (source === 'pa-media') {
      const paMediaApiKey = Deno.env.get('PA_MEDIA_API_KEY')
      if (!paMediaApiKey) {
        throw new Error('PA Media API key not configured')
      }
      
      // Fetch from PA Media API
      const paMediaResponse = await fetch('https://ngijsizuaxifqnjhbkuu.supabase.co/functions/v1/fetch-pa-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, pageSize })
      })
      
      if (!paMediaResponse.ok) {
        throw new Error('PA Media API request failed')
      }
      
      const paMediaData = await paMediaResponse.json()
      
      return new Response(
        JSON.stringify(paMediaData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    // Default to NewsAPI
    const apiKey = Deno.env.get('NEWSAPI_KEY')
    if (!apiKey) {
      throw new Error('NewsAPI key not configured')
    }

    // Map frontend categories to NewsAPI categories
    const categoryMapping: { [key: string]: string } = {
      'all': 'general',
      'business': 'business',
      'sport': 'sports',
      'politics': 'general', // Politics stories are usually in general
      'technology': 'technology'
    }

    const newsApiCategory = categoryMapping[category] || 'general'
    
    // For politics, we'll use keywords to filter more accurately
    const useKeywords = category === 'politics'
    let searchQuery = ''
    
    if (useKeywords) {
      searchQuery = 'politics OR government OR election OR congress OR senate'
    }

    // Construct NewsAPI URL - use everything endpoint for keyword searches
    const baseUrl = useKeywords ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines'
    const url = new URL(baseUrl)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('pageSize', pageSize.toString())
    url.searchParams.set('sortBy', 'publishedAt')
    url.searchParams.set('language', 'en')
    
    if (useKeywords && searchQuery) {
      url.searchParams.set('q', searchQuery)
      // For everything endpoint, we can also specify domains for better quality
      url.searchParams.set('domains', 'bbc.com,cnn.com,reuters.com,apnews.com,npr.org')
    } else {
      // For top-headlines endpoint
      url.searchParams.set('country', country)
      if (newsApiCategory !== 'general') {
        url.searchParams.set('category', newsApiCategory)
      }
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