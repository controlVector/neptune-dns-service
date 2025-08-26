import axios, { AxiosInstance } from 'axios'

export interface CloudflareCredentials {
  cloudflare_api_token?: string
  cloudflare_account_id?: string
  cloudflare_zone_id?: string
}

export class ContextService {
  private client: AxiosInstance
  private contextManagerUrl: string

  constructor(contextManagerUrl: string = 'http://localhost:3005') {
    this.contextManagerUrl = contextManagerUrl
    this.client = axios.create({
      baseURL: contextManagerUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Info': 'neptune-dns-agent'
      }
    })
  }

  /**
   * Get Cloudflare credentials from Context Manager
   */
  async getCloudflareCredentials(jwtToken?: string): Promise<CloudflareCredentials> {
    try {
      const headers: any = {}
      if (jwtToken) {
        headers.Authorization = `Bearer ${jwtToken}`
      }

      console.log('[Neptune ContextService] Retrieving Cloudflare credentials from Context Manager')

      const credentials: CloudflareCredentials = {}

      // Get Cloudflare API token
      credentials.cloudflare_api_token = await this.getCredential('cloudflare_api_token', headers)
      
      // Get Cloudflare Account ID
      credentials.cloudflare_account_id = await this.getCredential('cloudflare_account_id', headers)
      
      // Get optional Zone ID
      credentials.cloudflare_zone_id = await this.getCredential('cloudflare_zone_id', headers)

      console.log('[Neptune ContextService] Successfully retrieved credentials:', {
        has_api_token: !!credentials.cloudflare_api_token,
        has_account_id: !!credentials.cloudflare_account_id,
        has_zone_id: !!credentials.cloudflare_zone_id
      })

      return credentials
    } catch (error) {
      console.error('[Neptune ContextService] Failed to get Cloudflare credentials:', error)
      
      // Fallback to environment variables
      return {
        cloudflare_api_token: process.env.CLOUDFLARE_API_TOKEN,
        cloudflare_account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflare_zone_id: process.env.CLOUDFLARE_ZONE_ID
      }
    }
  }

  /**
   * Check if Context Manager is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 })
      return response.status === 200
    } catch (error) {
      console.warn('[Neptune ContextService] Context Manager health check failed:', error)
      return false
    }
  }

  // Private helper methods
  private async getCredential(key: string, headers: any): Promise<string | undefined> {
    try {
      console.log(`[Neptune ContextService] Requesting credential '${key}'`)
      
      if (headers.Authorization) {
        const token = headers.Authorization.replace('Bearer ', '')
        console.log(`[Neptune ContextService] Using JWT token: ${token.substring(0, 50)}...`)
      } else {
        console.warn(`[Neptune ContextService] No Authorization header present - using development mode`)
      }

      const response = await this.client.get(
        `/api/v1/context/secret/credential/${key}`,
        { headers }
      )
      
      console.log(`[Neptune ContextService] Context Manager response status: ${response.status}`)
      
      // Handle the Context Manager response format: {success: true, data: {value: "..."}}
      const credential = response.data.data || response.data.credential
      if (credential && credential.value) {
        console.log(`[Neptune ContextService] Successfully retrieved credential '${key}': ${credential.value.substring(0, 10)}...`)
        return credential.value
      } else if (response.data.value) {
        // Handle direct value format
        console.log(`[Neptune ContextService] Successfully retrieved credential '${key}': ${response.data.value.substring(0, 10)}...`)
        return response.data.value
      }
      
      console.log(`[Neptune ContextService] No credential value found for '${key}'`)
      return undefined
    } catch (error: any) {
      console.error(`[Neptune ContextService] Failed to get credential ${key}:`, error.response?.status, error.response?.data || error.message)
      return undefined
    }
  }
}