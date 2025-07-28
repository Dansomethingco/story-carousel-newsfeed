import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'general', country = 'gb', pageSize = 20 } = await req.json()
    
    console.log('=== FETCH NEWS STARTED ===')
    console.log('Category:', category, 'Country:', country, 'PageSize:', pageSize)
    
    // Fetch from both NewsAPI and PA Media in parallel
    console.log('Starting parallel fetch from NewsAPI and PA Media...')
    const [newsApiData, paMediaData] = await Promise.allSettled([
      fetchNewsAPI(category, country, Math.ceil(pageSize * 0.75)), // 75% from NewsAPI
      fetchPAMedia(category, Math.ceil(pageSize * 0.25)) // 25% from PA Media
    ])
    
    let newsApiArticles: any[] = []
    let paMediaArticles: any[] = []
    
    // Process NewsAPI results
    if (newsApiData.status === 'fulfilled') {
      newsApiArticles = newsApiData.value || []
      console.log(`Successfully fetched ${newsApiArticles.length} NewsAPI articles`)
    } else {
      console.error('NewsAPI failed:', newsApiData.reason)
    }
    
    // Process PA Media results
    if (paMediaData.status === 'fulfilled') {
      paMediaArticles = paMediaData.value || []
      console.log(`Successfully fetched ${paMediaArticles.length} PA Media articles`)
    } else {
      console.error('PA Media failed:', paMediaData.reason)
    }
    
    // Intertwine articles - PA Media every 4th position
    const interweavedArticles: any[] = []
    let newsIndex = 0
    let paIndex = 0
    
    for (let i = 0; i < pageSize && (newsIndex < newsApiArticles.length || paIndex < paMediaArticles.length); i++) {
      if ((i + 1) % 4 === 0 && paIndex < paMediaArticles.length) {
        // Every 4th article is from PA Media
        interweavedArticles.push(paMediaArticles[paIndex])
        paIndex++
      } else if (newsIndex < newsApiArticles.length) {
        // Other articles from NewsAPI
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      } else if (paIndex < paMediaArticles.length) {
        // If NewsAPI is exhausted, fill with PA Media
        interweavedArticles.push(paMediaArticles[paIndex])
        paIndex++
      }
    }
    
    console.log(`Final article mix: ${interweavedArticles.length} total articles`)
    
    return new Response(
      JSON.stringify({ 
        articles: interweavedArticles,
        totalResults: newsApiArticles.length + paMediaArticles.length
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

async function fetchNewsAPI(category: string, country: string, pageSize: number) {
  const apiKey = Deno.env.get('NEWSAPI_KEY')
  if (!apiKey) {
    throw new Error('NewsAPI key not configured')
  }

  // Map frontend categories to NewsAPI categories
  const categoryMapping: { [key: string]: string } = {
    'all': 'general',
    'business': 'business',
    'sport': 'sports',
    'politics': 'general',
    'technology': 'technology',
    'entertainment': 'entertainment'
  }

  const newsApiCategory = categoryMapping[category] || 'general'
  
  // For politics, use keywords for better accuracy
  const useKeywords = category === 'politics'
  let searchQuery = ''
  
  if (useKeywords) {
    searchQuery = 'politics OR government OR election OR congress OR senate'
  }

  const baseUrl = useKeywords ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines'
  const url = new URL(baseUrl)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('pageSize', pageSize.toString())
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('language', 'en')
  
  if (useKeywords && searchQuery) {
    url.searchParams.set('q', searchQuery)
    url.searchParams.set('domains', 'bbc.com,theguardian.com,sky.com,independent.co.uk,reuters.com,apnews.com')
  } else if (category === 'sport' && country === 'gb') {
    // For UK sports, use country filter and add search query to filter out US sports
    url.searchParams.set('country', country)
    url.searchParams.set('category', newsApiCategory)
    url.searchParams.set('q', '-NFL -NBA -MLB football OR tennis OR rugby OR cricket OR "Premier League" OR "Formula 1"')
  } else {
    url.searchParams.set('country', country)
    if (newsApiCategory !== 'general') {
      url.searchParams.set('category', newsApiCategory)
    }
  }

  console.log('Fetching NewsAPI:', url.toString().replace(apiKey, '[REDACTED]'))

  const response = await fetch(url.toString())
  
  if (!response.ok) {
    throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.status !== 'ok') {
    throw new Error(`NewsAPI error: ${data.message}`)
  }

  return data.articles.map((article: any, index: number) => ({
    id: `news-${Date.now()}-${index}`,
    title: article.title || 'Untitled',
    summary: article.description || '',
    content: article.content || article.description || '',
    image: article.urlToImage || `https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop`,
    source: article.source?.name || 'Unknown Source',
    category: category,
    publishedAt: article.publishedAt || new Date().toISOString(),
    readTime: `${Math.ceil((article.content?.length || 500) / 200)} min read`
  }))
}

async function fetchPAMedia(category: string, pageSize: number) {
  const categoryMapping: { [key: string]: string } = {
    'sport': 'sport',
    'entertainment': 'entertainment', 
    'business': 'finance',
    'all': '',
    'politics': '', 
    'technology': ''
  }
  
  const paMediaCategory = categoryMapping[category] || ''
  
  const apiKeys = ['b3ganyk474f4s4ct6dmkcnj7', 'y6zbp9drrb9fsrntc2p2rq7s']
  const baseUrl = 'https://content.api.pressassociation.io/v1/item'
  
  let lastError = null
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i]
    try {
      console.log(`Trying PA Media API key ${i + 1}/${apiKeys.length} for category: ${category}`)
      
      const url = new URL(baseUrl)
      url.searchParams.set('apikey', apiKey)
      url.searchParams.set('format', 'json')
      url.searchParams.set('size', pageSize.toString())
      
      // Add timestamp to ensure different results for each call
      url.searchParams.set('_t', Date.now().toString())
      
      if (paMediaCategory) {
        url.searchParams.set('category', paMediaCategory)
        console.log(`Using PA Media category filter: ${paMediaCategory}`)
      } else {
        // For categories without specific PA Media mapping, add search terms
        if (category === 'politics') {
          url.searchParams.set('q', 'politics government election')
        } else if (category === 'technology') {
          url.searchParams.set('q', 'technology tech AI computer')
        }
      }
      
      console.log('PA Media URL:', url.toString().replace(apiKey, '[REDACTED]'))

      const paResponse = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NewsApp/1.0'
        }
      })
      
      if (!paResponse.ok) {
        const errorText = await paResponse.text()
        console.error(`PA Media API key ${i + 1} failed: ${paResponse.status} - ${errorText}`)
        lastError = new Error(`API key ${i + 1}: ${paResponse.status} ${paResponse.statusText}`)
        continue
      }

      const paData = await paResponse.json()
      const items = paData.item || paData.items || paData.data || paData.articles || []
      
      // Log PA Media response structure to debug image fields
      if (items.length > 0) {
        console.log('PA Media item structure:', JSON.stringify(items[0], null, 2))
        console.log('Available image fields:', Object.keys(items[0]).filter(key => 
          key.toLowerCase().includes('image') || 
          key.toLowerCase().includes('picture') || 
          key.toLowerCase().includes('photo') || 
          key.toLowerCase().includes('rendition') ||
          key.toLowerCase().includes('media')
        ))
      }
      
      return items.map((item: any, index: number) => {
        // Map PA Media categories back to our frontend categories
        let mappedCategory = category;
        if (paMediaCategory === 'finance') {
          mappedCategory = 'business';
        } else if (paMediaCategory === 'sport') {
          mappedCategory = 'sport';
        } else if (paMediaCategory === 'entertainment') {
          mappedCategory = 'entertainment';
        }
        
        // Create unique ID with timestamp and category to prevent duplicates
        const uniqueId = `pa-${category}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`;
        
        // Extract image from PA Media - based on actual structure from logs
        let imageUrl = null;
        
        // PA Media stores images in associations.featureimage.renditions array
        if (item.associations?.featureimage?.renditions && Array.isArray(item.associations.featureimage.renditions) && item.associations.featureimage.renditions.length > 0) {
          // Find the largest image or use the first one
          const renditions = item.associations.featureimage.renditions;
          const bestImage = renditions.find((r: any) => r.width && r.width > 800) || 
                           renditions.find((r: any) => r.width && r.width > 400) || 
                           renditions[0];
          imageUrl = bestImage?.href || bestImage?.url;
          console.log('PA Media: Using featureimage rendition:', imageUrl)
        } 
        
        // If no featureimage, try direct renditions
        if (!imageUrl && item.renditions && Array.isArray(item.renditions) && item.renditions.length > 0) {
          const bestImage = item.renditions.find((r: any) => r.width && r.width > 400) || item.renditions[0];
          imageUrl = bestImage?.href || bestImage?.url;
          console.log('PA Media: Using direct rendition:', imageUrl)
        }
        
        // Fallback to category-specific placeholder if no image found
        const categoryImages = {
          sport: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
          business: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=400&fit=crop',
          entertainment: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=800&h=400&fit=crop',
          technology: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop'
        };
        
        return {
          id: uniqueId,
          title: item.headline || item.title || item.name || 'Untitled',
          summary: item.description_text || item.description || item.summary || '',
          content: item.body_text || item.content || item.body || item.description_text || '',
          image: imageUrl || categoryImages[mappedCategory] || `https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=800&h=400&fit=crop`,
          source: 'PA Media',
          category: mappedCategory,
          publishedAt: item.versioncreated || item.published || item.created_date || new Date().toISOString(),
          readTime: `${Math.ceil((item.body_text?.length || item.content?.length || 500) / 200)} min read`
        }
      })
      
    } catch (keyError) {
      console.error(`Error with PA Media API key ${i + 1}:`, keyError)
      lastError = keyError
      continue
    }
  }
  
  // If all keys failed, return empty array instead of throwing
  console.warn('All PA Media API keys failed, continuing without PA Media articles')
  return []

}