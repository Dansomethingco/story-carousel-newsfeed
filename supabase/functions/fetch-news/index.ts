import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { category = 'general', country = 'us', pageSize = 20, searchQuery } = await req.json()

    // Normalize frontend categories to backend categories
    const categoryMap: { [key: string]: string } = {
      'finance': 'business',
      'football': 'sports',
      'business': 'business',
      'sports': 'sports',
      'general': 'general',
      'all': 'general'
    }

    const normalizedCategory = categoryMap[category] || category
    
    console.log('=== FETCH NEWS STARTED ===')
    console.log(`Original Category: ${category} -> Normalized: ${normalizedCategory} | Country: ${country} | PageSize: ${pageSize}`)
    if (searchQuery) {
      console.log('Search Query:', searchQuery)
    }
    
    // Fetch from NewsAPI, YouTube, and Google Search in parallel (PA Media and Mediastack disabled due to API failures)
    console.log('Starting parallel fetch from NewsAPI, YouTube, and Google Search...')
    const [newsApiData, paMediaData, mediastackData, youtubeData, googleSearchData] = await Promise.allSettled([
      fetchNewsAPI(normalizedCategory, country, Math.ceil(pageSize * 0.4), searchQuery), // 40% from NewsAPI 
      fetchPAMedia(normalizedCategory, 0), // 0% from PA Media (disabled due to API failures)
      fetchMediastack(normalizedCategory, 0), // 0% from Mediastack (disabled due to rate limiting)
      fetchYouTube(normalizedCategory, Math.ceil(pageSize * 0.3), searchQuery), // 30% from YouTube
      fetchGoogleCustomSearch(normalizedCategory, Math.ceil(pageSize * 0.2), searchQuery) // 20% from Google Search
    ])
    
    let newsApiArticles: any[] = []
    let paMediaArticles: any[] = []
    let mediastackArticles: any[] = []
    let youtubeArticles: any[] = []
    let googleSearchArticles: any[] = []
    
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
    
    // Process Google Search results
    if (googleSearchData.status === 'fulfilled') {
      googleSearchArticles = googleSearchData.value || []
      console.log(`Successfully fetched ${googleSearchArticles.length} Google Search articles`)
    } else {
      console.error('Google Search failed:', googleSearchData.reason)
    }
    
    // Intertwine articles - mix all five sources
    const interweavedArticles: any[] = []
    let newsIndex = 0
    let paIndex = 0
    let mediastackIndex = 0
    let youtubeIndex = 0
    let googleIndex = 0
    
    for (let i = 0; i < pageSize; i++) {
      // Distribute articles: NewsAPI (40%), YouTube (30%), Google Search (20%), others (10%)
      const cyclePosition = i % 10
      
      if (cyclePosition < 4 && newsIndex < newsApiArticles.length) {
        // 40% NewsAPI (positions 0-3)
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      } else if (cyclePosition < 7 && youtubeIndex < youtubeArticles.length) {
        // 30% YouTube (positions 4-6)
        interweavedArticles.push(youtubeArticles[youtubeIndex])
        youtubeIndex++
      } else if (cyclePosition < 9 && googleIndex < googleSearchArticles.length) {
        // 20% Google Search (positions 7-8)
        interweavedArticles.push(googleSearchArticles[googleIndex])
        googleIndex++
      } 
      // Fill remaining positions with any available content
      else if (newsIndex < newsApiArticles.length) {
        interweavedArticles.push(newsApiArticles[newsIndex])
        newsIndex++
      } else if (youtubeIndex < youtubeArticles.length) {
        interweavedArticles.push(youtubeArticles[youtubeIndex])
        youtubeIndex++
      } else if (googleIndex < googleSearchArticles.length) {
        interweavedArticles.push(googleSearchArticles[googleIndex])
        googleIndex++
      } else {
        break // No more content available
      }
    }
    
    console.log(`Final article mix: ${interweavedArticles.length} total articles`)
    
    return new Response(
      JSON.stringify({ 
        articles: interweavedArticles,
        totalResults: newsApiArticles.length + paMediaArticles.length + mediastackArticles.length + youtubeArticles.length + googleSearchArticles.length
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

async function fetchNewsAPI(category: string, country: string, pageSize: number, searchQuery?: string) {
  const apiKey = Deno.env.get('NEWSAPI_KEY')
  if (!apiKey) {
    throw new Error('NewsAPI key not configured')
  }

  console.log(`NewsAPI: Processing category "${category}" for ${pageSize} articles`)

  // Map normalized categories to NewsAPI categories
  const categoryMapping: { [key: string]: string } = {
    'general': 'general',
    'business': 'business',
    'sports': 'sports',
    'politics': 'general',
    'technology': 'technology',
    'entertainment': 'entertainment'
  }

  const newsApiCategory = categoryMapping[category] || 'general'
  
  // For politics, business, and custom search queries, use keywords for better accuracy
  const useKeywords = category === 'politics' || category === 'business' || searchQuery
  let finalSearchQuery = ''
  let domains = ''
  
  if (useKeywords) {
    if (searchQuery) {
      // Enhanced search query processing for finance subcategories
      finalSearchQuery = enhanceFinanceSearchQuery(searchQuery)
      domains = 'bloomberg.com,cnbc.com,marketwatch.com,reuters.com,ft.com,wsj.com,forbes.com,businessinsider.com,morningstar.com,seekingalpha.com'
    } else if (category === 'politics') {
      finalSearchQuery = 'politics OR government OR election OR congress OR senate'
      domains = 'bbc.com,cnn.com,reuters.com,apnews.com,npr.org'
    } else if (category === 'business') {
      finalSearchQuery = 'finance OR stocks OR market OR economy OR business OR investing OR trading'
      domains = 'bloomberg.com,cnbc.com,marketwatch.com,reuters.com,ft.com,wsj.com,forbes.com,businessinsider.com'
    }
  }

  const baseUrl = useKeywords ? 'https://newsapi.org/v2/everything' : 'https://newsapi.org/v2/top-headlines'
  const url = new URL(baseUrl)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('pageSize', pageSize.toString())
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('language', 'en')
  
  if (useKeywords && finalSearchQuery) {
    url.searchParams.set('q', finalSearchQuery)
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

  // Filter out articles with insufficient content and check relevance for search queries
  const filteredArticles = articles.filter(article => {
    const hasTitle = article.title && article.title !== 'Untitled' && article.title.length > 10
    const hasContent = article.content && article.content.length > 100
    const hasSummary = article.summary && article.summary.length > 20
    
    // Basic content requirements
    const hasBasicContent = hasTitle && (hasContent || hasSummary)
    if (!hasBasicContent) {
      console.log(`Article filtered out for insufficient content: "${article.title}"`)
      return false
    }
    
    // If there's a specific search query, check relevance
    if (searchQuery && searchQuery.length > 5) {
      const isRelevant = isArticleRelevantToQuery(article, searchQuery)
      if (!isRelevant) {
        console.log(`Article filtered out for irrelevance to "${searchQuery}": "${article.title}"`)
      }
      return isRelevant
    }
    
    return true
  })
  
  console.log(`NewsAPI: Filtered ${articles.length - filteredArticles.length} irrelevant articles (${articles.length} -> ${filteredArticles.length})`)

  console.log(`Filtered ${articles.length - filteredArticles.length} articles with insufficient content`)
  return filteredArticles
}

// Check if article is relevant to the search query
function isArticleRelevantToQuery(article: any, searchQuery: string): boolean {
  const title = (article.title || '').toLowerCase()
  const summary = (article.summary || '').toLowerCase()
  const content = (article.content || '').toLowerCase()
  const combinedText = `${title} ${summary} ${content}`
  
  console.log(`Checking relevance for: "${article.title}" against query: "${searchQuery}"`)
  
  // First, check for obvious irrelevant topics that should be blocked
  const blockedTopics = [
    'shooting', 'murder', 'crime', 'police', 'arrest', 'court', 'legal case', 'lawsuit',
    'fashion week', 'plus-size', 'clothing', 'designer', 'runway', 'model',
    'celebrity', 'awards', 'emmy', 'oscar', 'entertainment', 'movie', 'tv show',
    'sports', 'football', 'basketball', 'soccer', 'baseball', 'hockey',
    'politics', 'election', 'candidate', 'vote', 'congress', 'senate', 'political'
  ]
  
  const hasBlockedContent = blockedTopics.some(topic => 
    title.includes(topic) || summary.includes(topic)
  )
  
  if (hasBlockedContent) {
    console.log(`Article blocked for containing irrelevant topic: "${article.title}"`)
    return false
  }
  
  // Define relevance keywords for each finance subcategory
  const relevanceMap: { [key: string]: string[] } = {
    'stocks': [
      'stock', 'stocks', 'share', 'shares', 'equity', 'trading', 'market', 'nasdaq', 'nyse', 
      'dow', 'sp500', 's&p', 'earnings', 'dividend', 'investor', 'analyst', 'price target',
      'revenue', 'profit', 'financial', 'ticker', 'volatility', 'bull', 'bear', 'index',
      'wall street', 'securities', 'portfolio', 'fund', 'etf', 'mutual fund'
    ],
    'crypto': [
      'crypto', 'bitcoin', 'ethereum', 'blockchain', 'cryptocurrency', 'digital currency',
      'defi', 'nft', 'web3', 'altcoin', 'mining', 'wallet', 'exchange', 'stablecoin',
      'btc', 'eth', 'cbdc', 'token', 'dapp', 'smart contract'
    ],
    'business': [
      'business', 'corporate', 'company', 'enterprise', 'ceo', 'revenue', 'merger',
      'acquisition', 'startup', 'ipo', 'quarterly', 'earnings', 'profit', 'loss',
      'strategy', 'operations', 'management', 'executive', 'board', 'shareholders'
    ],
    'global trade': [
      'trade', 'export', 'import', 'tariff', 'customs', 'international', 'global',
      'commerce', 'supply chain', 'logistics', 'wto', 'agreement', 'deficit', 'surplus',
      'sanctions', 'embargo', 'trade war', 'nafta', 'usmca', 'brexit'
    ]
  }
  
  // Determine which category this search query belongs to
  let relevantKeywords: string[] = []
  let categoryFound = ''
  for (const [category, keywords] of Object.entries(relevanceMap)) {
    if (searchQuery.toLowerCase().includes(category)) {
      relevantKeywords = keywords
      categoryFound = category
      break
    }
  }
  
  // If no specific category match, try to match individual terms
  if (relevantKeywords.length === 0) {
    // Extract key terms from the search query
    const queryTerms = searchQuery.toLowerCase()
      .split(/\s+or\s+|\s+and\s+|\s+/)
      .map(term => term.replace(/['"()]/g, '').trim())
      .filter(term => term.length > 2)
    
    // Check if at least 2 query terms appear in the article
    const matchCount = queryTerms.filter(term => combinedText.includes(term)).length
    const isRelevant = matchCount >= Math.min(2, queryTerms.length)
    console.log(`Generic relevance check: ${matchCount}/${queryTerms.length} terms matched (${isRelevant})`)
    return isRelevant
  }
  
  // Check if article contains relevant keywords
  const matchedKeywords = relevantKeywords.filter(keyword => 
    combinedText.includes(keyword)
  )
  
  // Require at least 2 relevant keywords for stocks/crypto, 1 for others
  const minMatches = ['stocks', 'crypto'].includes(categoryFound) ? 2 : 1
  const isRelevant = matchedKeywords.length >= minMatches
  
  console.log(`Category: ${categoryFound}, Keywords matched: ${matchedKeywords.length}/${relevantKeywords.length} (need ${minMatches}), Relevant: ${isRelevant}`)
  if (matchedKeywords.length > 0) {
    console.log(`Matched keywords: ${matchedKeywords.slice(0, 3).join(', ')}`)
  }
  
  return isRelevant
}

// Enhanced finance search query processing
function enhanceFinanceSearchQuery(searchQuery: string): string {
  // If it's already a specific finance search query, return as-is but optimized
  if (searchQuery.includes('stocks OR') || searchQuery.includes('cryptocurrency OR')) {
    return searchQuery
  }
  
  // Map simple terms to more comprehensive search queries
  const enhancementMap: { [key: string]: string } = {
    'stocks': 'stocks OR shares OR equity OR "stock market" OR "equity trading" OR "stock price" OR "stock analysis" OR "earnings report" OR "dividend" OR "market performance" OR "stock index" OR NYSE OR NASDAQ',
    'crypto': 'cryptocurrency OR bitcoin OR ethereum OR "crypto market" OR "digital currency" OR "crypto price" OR "crypto trading" OR "blockchain market" OR "crypto exchange" OR "crypto regulation" OR "crypto adoption" OR "crypto news"',
    'business': 'corporate OR "business strategy" OR "company earnings" OR "business expansion" OR "corporate restructuring" OR "business partnerships" OR "industry trends" OR "business innovation" OR "corporate governance" OR "business operations" OR "company merger" OR "business acquisition"',
    'global trade': 'international trade OR "trade agreement" OR "trade policy" OR "trade deal" OR "trade war" OR "trade relationship" OR "import export" OR "trade dispute" OR "trade negotiations" OR "global commerce" OR "cross-border trade" OR "trade deficit" OR "trade surplus"'
  }
  
  // Check if the search query matches any of our enhanced terms
  for (const [key, enhancedQuery] of Object.entries(enhancementMap)) {
    if (searchQuery.toLowerCase().includes(key)) {
      return enhancedQuery
    }
  }
  
  return searchQuery
}

async function fetchPAMedia(category: string, pageSize: number) {
  console.log(`PA Media: Processing category "${category}" for ${pageSize} articles`)

  // Map normalized categories to PA Media categories
  const categoryMapping: { [key: string]: string } = {
    'sports': 'sport',
    'entertainment': 'entertainment', 
    'business': 'finance',
    'general': '',
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

  console.log(`Mediastack: Processing category "${category}" for ${pageSize} articles`)

  // Map normalized categories to Mediastack categories
  const categoryMapping: { [key: string]: string } = {
    'general': 'general',
    'business': 'business',
    'sports': 'sports',
    'technology': 'technology',
    'entertainment': 'entertainment'
  }

  const mediastackCategory = categoryMapping[category] || 'general'
  
  try {
    console.log(`Fetching Mediastack articles for category: ${category} -> ${mediastackCategory}`)
    
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

async function fetchYouTube(category: string, pageSize: number, searchQuery?: string) {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY')
  if (!apiKey) {
    console.log('YouTube API key not configured, skipping YouTube videos')
    return []
  }

  console.log(`YouTube: Processing category "${category}" for ${pageSize} videos`)

  // Map normalized categories to specific search queries
  const searchQueries: { [key: string]: string } = {
    'general': 'breaking news',
    'sports': 'sports news',
    'business': 'finance OR "stock market" OR "financial markets" OR investing OR economy',
    'politics': 'politics news',
    'technology': 'technology news',
    'entertainment': 'entertainment news'
  }
  
  // Enhanced search query processing for finance subcategories
  const enhancedSearchQuery = searchQuery ? enhanceFinanceSearchQueryForYouTube(searchQuery) : null

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

  // Use enhanced search query if provided, otherwise use category-based query
  const finalSearchQuery = enhancedSearchQuery || searchQueries[category] || searchQueries['general']
  
  try {
    console.log(`Fetching YouTube videos for category: ${category} with query: ${finalSearchQuery}`)
    
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
      url.searchParams.set('q', finalSearchQuery)
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
      url.searchParams.set('q', finalSearchQuery)
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

// Enhanced finance search query processing for YouTube
function enhanceFinanceSearchQueryForYouTube(searchQuery: string): string {
  // Map finance subcategories to YouTube-optimized search queries
  const youtubeEnhancementMap: { [key: string]: string } = {
    'stocks': 'stock market analysis OR stock picks OR earnings report OR stock news OR market outlook OR equity research OR dividend stocks OR stock trading',
    'crypto': 'cryptocurrency news OR bitcoin analysis OR crypto market OR crypto trading OR blockchain news OR crypto price prediction OR ethereum news OR crypto updates',
    'business': 'business news OR corporate earnings OR CEO interview OR company analysis OR industry trends OR business strategy OR corporate governance OR business updates',
    'global trade': 'international trade OR trade war OR trade agreement OR global economy OR trade policy OR import export OR trade relations OR global business'
  }
  
  // Check if the search query matches any of our enhanced terms
  for (const [key, enhancedQuery] of Object.entries(youtubeEnhancementMap)) {
    if (searchQuery.toLowerCase().includes(key)) {
      return enhancedQuery
    }
  }
  
  return searchQuery
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

async function fetchGoogleCustomSearch(category: string, pageSize: number, searchQuery?: string) {
  const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY')
  const searchEngineId = Deno.env.get('GOOGLE_CUSTOM_SEARCH_ENGINE_ID')
  
  if (!apiKey || !searchEngineId) {
    console.log('Google Custom Search API key or Search Engine ID not configured')
    return []
  }

  console.log(`Google Search: Processing category "${category}" for ${pageSize} articles`)

  // Map normalized categories to Google search queries
  const categoryMapping: { [key: string]: string } = {
    'general': 'news',
    'business': 'finance business news',
    'sports': 'sports news',
    'politics': 'politics government news',
    'technology': 'technology tech news',
    'entertainment': 'entertainment celebrity news'
  }

  let finalSearchQuery = ''
  
  if (searchQuery) {
    // Enhanced search query processing for finance subcategories
    const enhancedQuery = enhanceFinanceSearchQueryForGoogle(searchQuery)
    finalSearchQuery = `${enhancedQuery} news`
  } else {
    finalSearchQuery = categoryMapping[category] || 'news'
  }

  try {
    console.log(`Fetching Google Custom Search for: ${finalSearchQuery}`)
    
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', searchEngineId)
    url.searchParams.set('q', finalSearchQuery)
    url.searchParams.set('num', Math.min(pageSize, 10).toString()) // Google allows max 10 results per request
    url.searchParams.set('dateRestrict', 'd1') // Last 24 hours for fresh news
    url.searchParams.set('sort', 'date') // Sort by date
    url.searchParams.set('lr', 'lang_en') // English language

    console.log('Google Custom Search URL:', url.toString().replace(apiKey, '[REDACTED]'))

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      console.error(`Google Custom Search request failed: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    
    if (!data.items || !Array.isArray(data.items)) {
      console.log('No Google Custom Search results found')
      return []
    }

    console.log(`Google Custom Search returned ${data.items.length} results`)

    // Process and enhance search results
    const articles = await Promise.all(
      data.items.map(async (item: any, index: number) => {
        // Try to scrape full content from the search result URL
        let fullContent = item.snippet || ''
        
        if (item.link) {
          const scrapedContent = await scrapeArticleContent(item.link)
          if (scrapedContent && scrapedContent.length > fullContent.length) {
            fullContent = scrapedContent
            console.log(`Enhanced Google Search result ${index + 1} with scraped content`)
          }
        }

        // Extract image from page meta or use a category-appropriate placeholder
        let imageUrl = null
        if (item.pagemap?.cse_image?.[0]?.src) {
          imageUrl = item.pagemap.cse_image[0].src
        } else if (item.pagemap?.metatags?.[0]?.['og:image']) {
          imageUrl = item.pagemap.metatags[0]['og:image']
        }

        // Category-specific placeholder images
        const categoryImages = {
          sport: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
          football: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=400&fit=crop',
          business: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=400&fit=crop',
          entertainment: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=800&h=400&fit=crop',
          technology: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=400&fit=crop',
          politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop'
        }
        
        // Extract source from URL domain
        let source = 'Google Search'
        try {
          const domain = new URL(item.link).hostname.replace('www.', '')
          source = domain.charAt(0).toUpperCase() + domain.slice(1)
        } catch (e) {
          // Use default source if URL parsing fails
        }

        return {
          id: `google-${Date.now()}-${index}`,
          title: item.title || 'Untitled',
          summary: item.snippet || '',
          content: fullContent,
          image: imageUrl || categoryImages[category] || 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=800&h=400&fit=crop',
          source: source,
          category: category,
          publishedAt: new Date().toISOString(), // Google doesn't provide publish date in search results
          readTime: `${Math.ceil((fullContent?.length || 300) / 200)} min read`,
          isVideo: false,
          url: item.link
        }
      })
    )

    // Filter out articles with insufficient content and check relevance
    const filteredArticles = articles.filter(article => {
      const hasTitle = article.title && article.title !== 'Untitled' && article.title.length > 10
      const hasSummary = article.summary && article.summary.length > 20
      
      // Basic content requirements
      const hasBasicContent = hasTitle && hasSummary
      if (!hasBasicContent) {
        console.log(`Google Search article filtered out for insufficient content: "${article.title}"`)
        return false
      }
      
      // If there's a specific search query, check relevance
      if (searchQuery && searchQuery.length > 5) {
        const isRelevant = isArticleRelevantToQuery(article, searchQuery)
        if (!isRelevant) {
          console.log(`Google Search article filtered out for irrelevance to "${searchQuery}": "${article.title}"`)
        }
        return isRelevant
      }
      
      return true
    })
    
    console.log(`Google Search: Filtered ${articles.length - filteredArticles.length} irrelevant articles (${articles.length} -> ${filteredArticles.length})`)

    console.log(`Filtered ${articles.length - filteredArticles.length} Google Search results with insufficient content`)
    return filteredArticles

  } catch (error) {
    console.error('Error fetching Google Custom Search:', error)
    return []
  }
}

// Enhanced finance search query processing for Google Custom Search
function enhanceFinanceSearchQueryForGoogle(searchQuery: string): string {
  // Map finance subcategories to Google-optimized search queries
  const googleEnhancementMap: { [key: string]: string } = {
    'stocks': 'stock market OR equity market OR stock analysis OR share price OR stock trading OR market performance OR earnings',
    'crypto': 'cryptocurrency OR bitcoin OR ethereum OR crypto market OR digital currency OR blockchain OR crypto trading OR crypto price',
    'business': 'corporate news OR business strategy OR company earnings OR corporate governance OR business operations OR industry analysis',
    'global trade': 'international trade OR trade agreement OR trade policy OR global commerce OR trade relations OR import export OR trade deficit'
  }
  
  // Check if the search query matches any of our enhanced terms
  for (const [key, enhancedQuery] of Object.entries(googleEnhancementMap)) {
    if (searchQuery.toLowerCase().includes(key)) {
      return enhancedQuery
    }
  }
  
  return searchQuery
}
