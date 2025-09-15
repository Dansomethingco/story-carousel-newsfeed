import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'general', country = 'us', pageSize = 20 } = await req.json()
    
    console.log('=== FETCH NEWS STARTED ===')
    console.log('Category:', category, 'Country:', country, 'PageSize:', pageSize)
    
    // Fetch from NewsAPI and YouTube in parallel (PA Media and Mediastack disabled due to API failures)
    console.log('Starting parallel fetch from NewsAPI and YouTube...')
    const [newsApiData, paMediaData, mediastackData, youtubeData] = await Promise.allSettled([
      fetchNewsAPI(category, country, Math.ceil(pageSize * 0.5)), // 50% from NewsAPI 
      fetchPAMedia(category, 0), // 0% from PA Media (disabled due to API failures)
      fetchMediastack(category, 0), // 0% from Mediastack (disabled due to rate limiting)
      fetchYouTube(category, Math.ceil(pageSize * 0.5)) // 50% from YouTube
    ])
    
    let newsApiArticles: any[] = []
    let paMediaArticles: any[] = []
    let mediastackArticles: any[] = []
    let youtubeArticles: any[] = []
    
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
    
    // Process Mediastack results
    if (mediastackData.status === 'fulfilled') {
      mediastackArticles = mediastackData.value || []
      console.log(`Successfully fetched ${mediastackArticles.length} Mediastack articles`)
    } else {
      console.error('Mediastack failed:', mediastackData.reason)
    }
    
    // Process YouTube results
    if (youtubeData.status === 'fulfilled') {
      youtubeArticles = youtubeData.value || []
      console.log(`Successfully fetched ${youtubeArticles.length} YouTube videos`)
    } else {
      console.error('YouTube failed:', youtubeData.reason)
    }
    
    // Intertwine articles - mix all four sources
    const interweavedArticles: any[] = []
    let newsIndex = 0
    let paIndex = 0
    let mediastackIndex = 0
    let youtubeIndex = 0
    
    for (let i = 0; i < pageSize && (newsIndex < newsApiArticles.length || youtubeIndex < youtubeArticles.length); i++) {
      // Alternate between NewsAPI (50%) and YouTube (50%)
      if (i % 2 === 0 && newsIndex < newsApiArticles.length) {
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      } else if (youtubeIndex < youtubeArticles.length) {
        interweavedArticles.push(youtubeArticles[youtubeIndex])
        youtubeIndex++
      } 
      // Fill remaining positions with any available content
      else if (newsIndex < newsApiArticles.length) {
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      }
    }
    
    console.log(`Final article mix: ${interweavedArticles.length} total articles`)
    
    return new Response(
      JSON.stringify({ 
        articles: interweavedArticles,
        totalResults: newsApiArticles.length + paMediaArticles.length + mediastackArticles.length + youtubeArticles.length
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

// Web scraping function to get full article content
async function scrapeArticleContent(url: string): Promise<string> {
  try {
    console.log('Scraping article content from:', url)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      console.log(`Failed to fetch article: ${response.status}`)
      return ''
    }
    
    const html = await response.text()
    
    // Simple content extraction - look for common article containers
    const articlePatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i
    ]
    
    let content = ''
    for (const pattern of articlePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        content = match[1]
        break
      }
    }
    
    if (!content) {
      // Fallback: extract from body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      content = bodyMatch ? bodyMatch[1] : html
    }
    
    // Clean up HTML tags and extract text
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Extract meaningful paragraphs (longer than 50 characters)
    const paragraphs = content.split(/[.!?]+\s+/)
      .filter(p => p.trim().length > 50)
      .slice(0, 10) // Take first 10 meaningful paragraphs
    
    const extractedContent = paragraphs.join('. ').trim()
    console.log(`Extracted ${extractedContent.length} characters from article`)
    
    return extractedContent || ''
  } catch (error) {
    console.error('Error scraping article:', error)
    return ''
  }
}

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
  
  // For politics and business, use keywords for better accuracy
  const useKeywords = category === 'politics' || category === 'business'
  let searchQuery = ''
  let domains = ''
  
  if (useKeywords) {
    if (category === 'politics') {
      searchQuery = 'politics OR government OR election OR congress OR senate'
      domains = 'bbc.com,cnn.com,reuters.com,apnews.com,npr.org'
    } else if (category === 'business') {
      searchQuery = 'finance OR stocks OR market OR economy OR business OR investing OR trading'
      domains = 'bloomberg.com,cnbc.com,marketwatch.com,reuters.com,ft.com,wsj.com,forbes.com,businessinsider.com'
    }
  }

  const baseUrl = useKeywords ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines'
  const url = new URL(baseUrl)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('pageSize', pageSize.toString())
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('language', 'en')
  
  if (useKeywords && searchQuery) {
    url.searchParams.set('q', searchQuery)
    if (domains) {
      url.searchParams.set('domains', domains)
    }
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

  // Process articles and scrape full content
  const articles = await Promise.all(
    data.articles.map(async (article: any, index: number) => {
      let fullContent = article.content || article.description || ''
      
      // If content is truncated (contains [+X chars] or [removed]), scrape full content
      if (fullContent.includes('[+') || fullContent.includes('[removed]') || fullContent.length < 200) {
        if (article.url) {
          const scrapedContent = await scrapeArticleContent(article.url)
          if (scrapedContent && scrapedContent.length > fullContent.length) {
            fullContent = scrapedContent
            console.log(`Enhanced NewsAPI article ${index + 1} with scraped content`)
          }
        }
      }

      // Only use image if it exists and is a valid URL, otherwise set to null
      let imageUrl = null;
      if (article.urlToImage && article.urlToImage.trim() && article.urlToImage.startsWith('http')) {
        imageUrl = article.urlToImage;
      }
      
      return {
        id: `news-${Date.now()}-${index}`,
        title: article.title || 'Untitled',
        summary: article.description || '',
        content: fullContent,
        image: imageUrl,
        source: article.source?.name || 'Unknown Source',
        category: category,
        publishedAt: article.publishedAt || new Date().toISOString(),
        readTime: `${Math.ceil((fullContent?.length || 500) / 200)} min read`,
        isVideo: false
      }
    })
  )

  // Filter out articles with insufficient content (likely behind paywalls)
  const filteredArticles = articles.filter(article => {
    const hasTitle = article.title && article.title !== 'Untitled' && article.title.length > 10
    const hasContent = article.content && article.content.length > 100
    const hasSummary = article.summary && article.summary.length > 20
    
    // Article must have a proper title and either substantial content or a good summary
    return hasTitle && (hasContent || hasSummary)
  })

  console.log(`Filtered ${articles.length - filteredArticles.length} articles with insufficient content`)
  return filteredArticles
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
          readTime: `${Math.ceil((item.body_text?.length || item.content?.length || 500) / 200)} min read`,
          isVideo: false
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

async function fetchMediastack(category: string, pageSize: number) {
  const apiKey = Deno.env.get('MEDIASTACK_ACCESS_KEY')
  if (!apiKey) {
    console.log('Mediastack API key not configured, skipping Mediastack articles')
    return []
  }

  // Map frontend categories to Mediastack categories
  const categoryMapping: { [key: string]: string } = {
    'all': 'general',
    'business': 'business',
    'sport': 'sports',
    'technology': 'technology',
    'entertainment': 'entertainment'
  }

  const mediastackCategory = categoryMapping[category] || 'general'
  
  try {
    console.log(`Fetching Mediastack articles for category: ${category}`)
    
    const url = new URL('https://api.mediastack.com/v1/news')
    url.searchParams.set('access_key', apiKey)
    url.searchParams.set('languages', 'en')
    url.searchParams.set('limit', pageSize.toString())
    url.searchParams.set('sort', 'published_desc')
    
    if (mediastackCategory !== 'general') {
      url.searchParams.set('categories', mediastackCategory)
    }
    
    console.log('Mediastack URL:', url.toString().replace(apiKey, '[REDACTED]'))

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`Mediastack request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.error) {
      throw new Error(`Mediastack error: ${data.error.message}`)
    }

    const articles = data.data || []
    
    const processedArticles = articles.map((article: any, index: number) => {
      let mappedCategory = category;
      if (mediastackCategory === 'sports') {
        mappedCategory = 'sport';
      }
      
      // Only use image if it exists and is a valid URL, otherwise set to null
      let imageUrl = null;
      if (article.image && article.image.trim() && article.image.startsWith('http')) {
        imageUrl = article.image;
      }
      
      return {
        id: `mediastack-${category}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        title: article.title || 'Untitled',
        summary: article.description || '',
        content: article.description || '', // Mediastack only provides descriptions, not full content
        image: imageUrl,
        source: article.source || 'Mediastack',
        category: mappedCategory,
        publishedAt: article.published_at || new Date().toISOString(),
        readTime: `${Math.ceil((article.description?.length || 500) / 200)} min read`,
        isVideo: false
      }
    })
    
    // Filter out articles with insufficient content (likely behind paywalls)
    const filteredArticles = processedArticles.filter(article => {
      const hasTitle = article.title && article.title !== 'Untitled' && article.title.length > 10
      const hasContent = article.content && article.content.length > 100
      const hasSummary = article.summary && article.summary.length > 20
      
      // Article must have a proper title and either substantial content or a good summary
      return hasTitle && (hasContent || hasSummary)
    })

    console.log(`Mediastack: Filtered ${processedArticles.length - filteredArticles.length} articles with insufficient content`)
    return filteredArticles
    
  } catch (error) {
    console.error('Error fetching Mediastack articles:', error)
    return []
  }
}

async function fetchYouTube(category: string, pageSize: number) {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY')
  if (!apiKey) {
    console.log('YouTube API key not configured, skipping YouTube videos')
    return []
  }

  // Map categories to specific search queries
  const searchQueries: { [key: string]: string } = {
    'all': 'breaking news',
    'sport': 'sports news',
    'business': 'finance OR "stock market" OR "financial markets" OR investing OR economy',
    'politics': 'politics news',
    'technology': 'technology news',
    'entertainment': 'entertainment news'
  }

  // Target news channels, with finance-specific channels for business category
  const getChannelsForCategory = (cat: string) => {
    if (cat === 'business') {
      return [
        'UCfMRmYHye7PropL5FnXl2vg', // CNBC
        'UCIALMKvObZNtJ6AmdCLP7Lg', // Bloomberg Markets and Finance
        'UCKkS6d0cKMBL8ziYFO6k2ag', // Financial Times
        'UCrp_UI8XtuYfpiqluWLD7Lw', // MarketWatch
        'UCfMRmYHye7PropL5FnXl2vg', // CNBC International
        'UC2ts2r9_VKyIW95x7-y-lUg', // Yahoo Finance
        'UCF26Pp77CZxyR5z3vDsl11g', // Investing.com
      ]
    } else {
      return [
        'UChqUTb7kYRX8-EiaN3XFrSQ', // BBC News
        'UCaO6VoaYJv4kS-TQO_M-N_g', // Sky News
        'UC6uKrU_WqJ1R2HMTY3LIx5Q', // ITV News
        'UCbLGY0LE3AAIUQ1xKjWK0nQ', // Channel 4 News
        'UC7sKjgexQyOqaT_hLTZZa6Q', // GBNews
        'UCLr3JBqAV5B7_Z_Bi9qS8iQ', // TalkTV
        'UCEcWIpRNf6dJ9IpxJ3bVoMw', // Guardian News
        'UCJyR9zJUUbLyV6C-2Dk9MmA', // Times News
        'UCL2rKZvF-ow5_JUhlNJhO_Q', // The Telegraph
        'UC8oETwb3P4xGDqjQr6FzGSw', // The Sun
        'UC5i68sO3w6wvNk8lQaOJGLA', // Daily Mail World
        'UCUkWKE-RX1BlXH31NkZhm4g', // The Mirror
        'UC0fDgfgaWRLOlqSJr4rMUAQ', // Daily Express
        'UCqFfguwqnKaNnRPPrpYT5nA', // Metro_UK
        'UCJWDNhLBKhBU2YqZoKhz4Xw', // The Independent
        'UCkWQ0gDrqOCarmUKmppD7GQ', // The Economist
        'UCJ7wYCT7aBRnr7_EO-UJx9Q', // New Statesman
        'UC7_l_Bhu-V3OvFhYxDYOj7A', // SpectatorTV
        'UCNAf1k0yIjyGu3k9BwAg3lg', // Sky Sports
        'UCw6SJIJx-TYz6YBK2lVLCqw', // TNT Sports
        'UC_VhdOOEVKM5tXjF5B8e0Aw', // BBC Sport
        'UC4k8iTGOUBaKCRa4PKvJ4pw', // talkSPORT
        'UCQvQ8LPxhq7TzUpRFPAJGdQ'  // The Football Terrace
      ]
    }
  }

  const newsChannels = getChannelsForCategory(category)

  const searchQuery = searchQueries[category] || searchQueries['all']
  
  try {
    console.log(`Fetching YouTube videos for category: ${category} with query: ${searchQuery}`)
    
    // First try searching from specific UK news channels
    let allVideos = []
    
    // Get priority channels based on category
    const priorityChannels = category === 'business' 
      ? [
          'UCfMRmYHye7PropL5FnXl2vg', // CNBC
          'UCIALMKvObZNtJ6AmdCLP7Lg', // Bloomberg Markets and Finance
          'UCKkS6d0cKMBL8ziYFO6k2ag', // Financial Times
          'UCrp_UI8XtuYfpiqluWLD7Lw', // MarketWatch
        ]
      : [
          'UChqUTb7kYRX8-EiaN3XFrSQ', // BBC News
          'UCaO6VoaYJv4kS-TQO_M-N_g', // Sky News
          'UC6uKrU_WqJ1R2HMTY3LIx5Q', // ITV News
          'UCbLGY0LE3AAIUQ1xKjWK0nQ', // Channel 4 News
        ]
    
    // Try each priority channel individually
    for (const channelId of priorityChannels) {
      if (allVideos.length >= pageSize) break
      
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('q', searchQuery)
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'date')
      url.searchParams.set('maxResults', '2') // Get 2 videos per priority channel
      // Use longer time window for finance category to get more content
      const timeWindow = category === 'business' ? 7 * 24 * 60 * 60 * 1000 : 72 * 60 * 60 * 1000 // 7 days for finance, 3 days for others
      url.searchParams.set('publishedAfter', new Date(Date.now() - timeWindow).toISOString())
      url.searchParams.set('relevanceLanguage', 'en')
      url.searchParams.set('regionCode', 'GB')
      url.searchParams.set('channelId', channelId)
      
      try {
        const response = await fetch(url.toString())
        if (response.ok) {
          const data = await response.json()
          const videos = data.items || []
          allVideos.push(...videos)
        }
      } catch (err) {
        console.log(`Failed to fetch from channel ${channelId}:`, err)
      }
    }
    
    // If we don't have enough videos, do a general search
    if (allVideos.length < pageSize) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('q', searchQuery)
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'date')
      url.searchParams.set('maxResults', (pageSize - allVideos.length).toString())
      // Use longer time window for finance category to get more content
      const timeWindow = category === 'business' ? 7 * 24 * 60 * 60 * 1000 : 72 * 60 * 60 * 1000 // 7 days for finance, 3 days for others
      url.searchParams.set('publishedAfter', new Date(Date.now() - timeWindow).toISOString())
      url.searchParams.set('relevanceLanguage', 'en')
      url.searchParams.set('regionCode', 'GB')
      
      console.log('YouTube general search URL:', url.toString().replace(apiKey, '[REDACTED]'))

      const response = await fetch(url.toString())
      
      if (response.ok) {
        const data = await response.json()
        const videos = data.items || []
        allVideos.push(...videos)
      }
    }
    
    console.log(`Found ${allVideos.length} YouTube videos total`)
    
    // Filter out non-English videos
    const englishVideos = allVideos.filter((video: any) => {
      const title = video.snippet.title || ''
      const description = video.snippet.description || ''
      
      // Check if title contains only English characters (Latin alphabet, numbers, common punctuation)
      const englishRegex = /^[a-zA-Z0-9\s\-_.,!?:;'"()\[\]{}@#$%&*+=|\\/<>~`^]*$/
      const isEnglishTitle = englishRegex.test(title)
      
      // Additional check for common non-English patterns
      const hasNonEnglishChars = /[\u0080-\uFFFF]/.test(title + description)
      
      return isEnglishTitle && !hasNonEnglishChars
    })
    
    console.log(`Filtered to ${englishVideos.length} English-only videos`)
    
    // Get additional video details including duration for English videos only
    const videoIds = englishVideos.map((video: any) => video.id.videoId).join(',')
    
    if (videoIds) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
      detailsUrl.searchParams.set('key', apiKey)
      detailsUrl.searchParams.set('part', 'contentDetails,statistics')
      detailsUrl.searchParams.set('id', videoIds)
      
      const detailsResponse = await fetch(detailsUrl.toString())
      const detailsData = await detailsResponse.json()
      const videoDetails = detailsData.items || []
      
      return englishVideos.slice(0, pageSize).map((video: any, index: number) => {
        const details = videoDetails.find((d: any) => d.id === video.id.videoId)
        const duration = details ? parseDuration(details.contentDetails.duration) : 'N/A'
        
        return {
          id: `youtube-${category}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          title: video.snippet.title || 'Untitled Video',
          summary: video.snippet.description ? video.snippet.description.substring(0, 200) + '...' : '',
          content: video.snippet.description || '',
          image: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
          source: video.snippet.channelTitle || 'YouTube',
          category: category,
          publishedAt: video.snippet.publishedAt || new Date().toISOString(),
          readTime: duration,
          isVideo: true,
          videoId: video.id.videoId,
          embedUrl: `https://www.youtube.com/embed/${video.id.videoId}`,
          videoThumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url
        }
      })
    }
    
    return []
    
  } catch (error) {
    console.error('Error fetching YouTube videos:', error)
    return []
  }
}

// Helper function to parse YouTube duration format (PT4M13S -> 4:13)
function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 'N/A'
  
  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}
