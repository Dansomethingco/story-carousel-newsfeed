
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'news', pageSize = 20 } = await req.json()
    
    // Use the provided API keys - try both as fallbacks
    const apiKeys = ['b3ganyk474f4s4ct6dmkcnj7', 'y6zbp9drrb9fsrntc2p2rq7s'] // Updated API keys
    
    console.log('Starting PA Media API call with:', {
      category,
      pageSize,
      availableKeys: apiKeys.length
    })
    
    let lastError = null
    
    // Try each API key
    for (const apiKey of apiKeys) {
      try {
        console.log('Trying API key:', apiKey.substring(0, 8) + '...')
        
        const baseUrl = 'https://content.api.pressassociation.io/v1/item'
        const url = new URL(baseUrl)
        url.searchParams.set('apikey', apiKey)
        url.searchParams.set('format', 'json')
        url.searchParams.set('size', pageSize.toString())
        
        console.log('Fetching PA Media content from:', url.toString().replace(apiKey, '[REDACTED]'))

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NewsApp/1.0'
          }
        })
        
        console.log('PA Media API response status:', response.status)
        console.log('PA Media API response headers:', Object.fromEntries(response.headers.entries()))
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Endpoint ${baseUrl} failed: ${response.status} ${response.statusText} - ${errorText}`)
          lastError = new Error(`${baseUrl}: ${response.status} ${response.statusText} - ${errorText}`)
          continue // Try next endpoint
        }

        const data = await response.json()
        console.log('PA Media API response structure:', Object.keys(data))
        console.log('Sample response data:', JSON.stringify(data, null, 2).substring(0, 500))
        
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

        console.log(`Successfully fetched ${transformedArticles.length} PA Media articles from ${baseUrl}`)

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
        
      } catch (endpointError) {
        console.error(`Error with endpoint ${baseUrl}:`, endpointError)
        lastError = endpointError
        continue // Try next endpoint
      }
    }
    
    // If we get here, all endpoints failed
    throw lastError || new Error('All PA Media API endpoints failed')

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
