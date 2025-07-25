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
      console.log('Fetching from PA Media API with category:', category)
      
      // Map our categories to PA Media categories
      const categoryMapping: { [key: string]: string } = {
        'sport': 'sport',
        'entertainment': 'entertainment', 
        'business': 'finance',
        'all': '', // No category filter for "all"
        'politics': '', // PA Media doesn't have politics, so no filter
        'technology': '' // PA Media doesn't have technology, so no filter
      }
      
      const paMediaCategory = categoryMapping[category] || ''
      
      // Use the provided API keys - try both as fallbacks
      const apiKeys = ['b3ganyk474f4s4ct6dmkcnj7', 'y6zbp9drrb9fsrntc2p2rq7s']
      const baseUrl = 'https://content.api.pressassociation.io/v1/item'
      
      let lastError = null
      
      // Try each API key
      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i]
        try {
          console.log(`Trying PA Media API key ${i + 1}/${apiKeys.length}: ${apiKey.substring(0, 8)}...`)
          
          const url = new URL(baseUrl)
          url.searchParams.set('apikey', apiKey)
          url.searchParams.set('format', 'json')
          url.searchParams.set('size', pageSize.toString())
          
          // Add category filter if we have a mapped category
          if (paMediaCategory) {
            url.searchParams.set('category', paMediaCategory)
            console.log(`Using PA Media category filter: ${paMediaCategory}`)
          } else {
            console.log('No category filter applied - fetching all PA Media content')
          }
          
          console.log('PA Media URL:', url.toString().replace(apiKey, '[REDACTED]'))

          const paResponse = await fetch(url.toString(), {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'NewsApp/1.0'
            }
          })
          
          console.log('PA Media response status:', paResponse.status)
          console.log('PA Media response headers:', Object.fromEntries(paResponse.headers.entries()))
          
          if (!paResponse.ok) {
            const errorText = await paResponse.text()
            console.error(`PA Media API key ${i + 1} failed: ${paResponse.status} - ${errorText}`)
            lastError = new Error(`API key ${i + 1}: ${paResponse.status} ${paResponse.statusText} - ${errorText}`)
            continue
          }

          const paData = await paResponse.json()
          console.log('PA Media response structure:', Object.keys(paData))
          console.log('PA Media sample data:', JSON.stringify(paData, null, 2).substring(0, 1000))
          
          // Check different possible response structures
          const items = paData.items || paData.data || paData.articles || []
          
          // Transform PA Media articles to match our interface
          const transformedArticles = items.map((item: any, index: number) => ({
            id: `pa-${item.id || Date.now()}-${index}`,
            title: item.headline || item.title || item.name || 'Untitled',
            summary: item.description || item.summary || item.snippet || '',
            content: item.body_text || item.content || item.body || item.description || '',
            image: item.renditions?.[0]?.href || item.image_url || item.image || '/placeholder.svg',
            source: 'PA Media',
            category: category,
            publishedAt: item.published || item.created_date || item.date || new Date().toISOString(),
            readTime: `${Math.ceil((item.body_text?.length || item.content?.length || 500) / 200)} min read`
          }))

          console.log(`Successfully fetched ${transformedArticles.length} PA Media articles`)

          return new Response(
            JSON.stringify({ 
              articles: transformedArticles,
              totalResults: paData.total || paData.count || transformedArticles.length 
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
          
        } catch (keyError) {
          console.error(`Error with PA Media API key ${i + 1}:`, keyError)
          lastError = keyError
          continue
        }
      }
      
      // If we get here, all API keys failed
      throw lastError || new Error('All PA Media API keys failed')
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