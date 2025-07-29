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
    
    // Fetch from NewsAPI, PA Media, Mediastack, and YouTube in parallel
    console.log('Starting parallel fetch from NewsAPI, PA Media, Mediastack, and YouTube...')
    const [newsApiData, paMediaData, mediastackData, youtubeData] = await Promise.allSettled([
      fetchNewsAPI(category, country, Math.ceil(pageSize * 0.3)), // 30% from NewsAPI (reduced from 50%)
      fetchPAMedia(category, Math.ceil(pageSize * 0.2)), // 20% from PA Media
      fetchMediastack(category, Math.ceil(pageSize * 0.3)), // 30% from Mediastack
      fetchYouTube(category, Math.ceil(pageSize * 0.2)) // 20% from YouTube
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
    
    for (let i = 0; i < pageSize && (newsIndex < newsApiArticles.length || paIndex < paMediaArticles.length || mediastackIndex < mediastackArticles.length || youtubeIndex < youtubeArticles.length); i++) {
      if ((i + 1) % 5 === 0 && youtubeIndex < youtubeArticles.length) {
        // Every 5th article is from YouTube (20%)
        interweavedArticles.push(youtubeArticles[youtubeIndex])
        youtubeIndex++
      } else if ((i + 1) % 4 === 0 && paIndex < paMediaArticles.length) {
        // Every 4th article is from PA Media
        interweavedArticles.push(paMediaArticles[paIndex])
        paIndex++
      } else if ((i + 1) % 7 === 0 && mediastackIndex < mediastackArticles.length) {
        // Every 7th article is from Mediastack
        interweavedArticles.push(mediastackArticles[mediastackIndex])
        mediastackIndex++
      } else if (newsIndex < newsApiArticles.length) {
        // Other articles from NewsAPI
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      } else if (paIndex < paMediaArticles.length) {
        // Fill with PA Media if NewsAPI is exhausted
        interweavedArticles.push(paMediaArticles[paIndex])
        paIndex++
      } else if (mediastackIndex < mediastackArticles.length) {
        // Fill with Mediastack
        interweavedArticles.push(mediastackArticles[mediastackIndex])
        mediastackIndex++
      } else if (youtubeIndex < youtubeArticles.length) {
        // Fill with YouTube videos
        interweavedArticles.push(youtubeArticles[youtubeIndex])
        youtubeIndex++
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
    url.searchParams.set('domains', 'bbc.com,cnn.com,reuters.com,apnews.com,npr.org')
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
      
      return {
        id: `news-${Date.now()}-${index}`,
        title: article.title || 'Untitled',
        summary: article.description || '',
        content: fullContent,
        image: article.urlToImage || `https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop`,
        source: article.source?.name || 'Unknown Source',
        category: category,
        publishedAt: article.publishedAt || new Date().toISOString(),
        readTime: `${Math.ceil((fullContent?.length || 500) / 200)} min read`,
        isVideo: false
      }
    })
  )
  
  return articles
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
    
    return articles.map((article: any, index: number) => {
      // Map Mediastack categories back to our frontend categories
      let mappedCategory = category;
      if (mediastackCategory === 'sports') {
        mappedCategory = 'sport';
      }
      
      return {
        id: `mediastack-${category}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        title: article.title || 'Untitled',
        summary: article.description || '',
        content: article.description || '', // Mediastack only provides descriptions, not full content
        image: article.image || `https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop`,
        source: article.source || 'Mediastack',
        category: mappedCategory,
        publishedAt: article.published_at || new Date().toISOString(),
        readTime: `${Math.ceil((article.description?.length || 500) / 200)} min read`,
        isVideo: false
      }
    })
    
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

  // Enhanced search queries with English-speaking regions (UK, US, Australia)
  const searchQueries: { [key: string]: string } = {
    'all': 'breaking news latest news today UK US Australia english',
    'sport': 'sports news football rugby cricket f1 UK US Australia premier league NFL NBA',
    'business': 'breaking finance business news UK US Australia stock market economy',
    'politics': 'politics news government election trump starmer UK US Australia parliament',
    'technology': 'breaking news technology science space UK US Australia tech',
    'entertainment': 'breaking music entertainment movie news UK US Australia hollywood'
  }

  // Expanded English-speaking news channels (UK, US, Australia)
  const englishNewsChannels = [
    // US Channels
    'UCupvZG-5ko_eiXAupbDfxWw', // CNN
    'UChi4LTh6KRGkQYJRFDnpN9w', // NBC News
    'UCqnbDFdCpuN8CMEg0VuEBqA', // ABC News
    'UC46nQZ2DpT0_hK4aJ-rw_1g', // CBS News
    'UCv3Q_4dFkM0ws_blwajstJQ', // Fox News
    // UK Channels
    'UChqUTb7kYRX8-EiaN3XFrSQ', // BBC News
    'UCaO6VoaYJv4kS-TQO_M-N_g', // Sky News
    'UCOReNCLa8e8ZhTwGRyw_h3Q', // ITV News
    'UC2Kpn46t2_mNlBD5khBDLdQ', // Channel 4 News
    // Australia Channels
    'UCVgO39Bk5_p_RJkuOHriQAg', // ABC News Australia
    'UCaO6VoaYJv4kS-TQO_M-N_g', // Sky News Australia
    'UCBcRw-dJvdMDDamZKjJJx7A', // 7NEWS Australia
    // International
    'UCR-_HpHfVLKkMCPQg9lMLZA', // Reuters
  ]

  const searchQuery = searchQueries[category] || searchQueries['all']
  
  try {
    console.log(`Fetching YouTube videos for category: ${category} with query: ${searchQuery}`)
    
    // Multi-region search strategy - try different region codes for better English coverage
    const regions = ['US', 'GB', 'AU']
    let allVideos: any[] = []
    
    for (const region of regions) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('q', searchQuery)
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'date')
      url.searchParams.set('maxResults', Math.ceil(pageSize / regions.length).toString())
      url.searchParams.set('publishedAfter', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      url.searchParams.set('relevanceLanguage', 'en')
      url.searchParams.set('regionCode', region)
      url.searchParams.set('safeSearch', 'moderate')
      
      console.log(`YouTube URL for ${region}:`, url.toString().replace(apiKey, '[REDACTED]'))

      const response = await fetch(url.toString())
      
      if (response.ok) {
        const data = await response.json()
        if (!data.error && data.items) {
          allVideos.push(...data.items)
        }
      }
    }
    
    // Relaxed filtering - rely on search queries for English content
    const filteredVideos = allVideos.filter(video => {
      const videoTitle = video.snippet.title || ''
      
      // Basic content quality filter only
      return videoTitle.length > 10 // Ensure video has a reasonable title
    })
    
    // Remove duplicates based on video ID and take only requested amount
    const uniqueVideos = filteredVideos
      .filter((video, index, self) => 
        index === self.findIndex(v => v.id.videoId === video.id.videoId)
      )
      .slice(0, pageSize)
    
    // Get additional video details including duration for filtered videos
    const videoIds = uniqueVideos.map((video: any) => video.id.videoId).join(',')
    
    if (videoIds) {
      const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
      detailsUrl.searchParams.set('key', apiKey)
      detailsUrl.searchParams.set('part', 'contentDetails,statistics')
      detailsUrl.searchParams.set('id', videoIds)
      
      const detailsResponse = await fetch(detailsUrl.toString())
      const detailsData = await detailsResponse.json()
      const videoDetails = detailsData.items || []
      
      return uniqueVideos.map((video: any, index: number) => {
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
