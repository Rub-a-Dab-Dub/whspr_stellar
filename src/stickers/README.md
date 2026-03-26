# Stickers & GIFs Module

A comprehensive NestJS module for managing animated stickers and GIFs within conversations, featuring a built-in sticker pack system and Tenor/Giphy API integration.

## Features

- 🎨 **Official Sticker Packs**: Pre-loaded CDN sticker packs
- 🔍 **Smart Search**: Search stickers by name and tags
- 🎬 **Tenor Integration**: GIF search powered by Tenor API
- ⚡ **Caching**: Redis-based caching with configurable TTLs
  - Sticker packs: 10-minute TTL
  - GIF search results: 5-minute TTL
- 📱 **Message Types**: Native support for STICKER and GIF message types
- ✅ **High Test Coverage**: >=85% unit test coverage

## Architecture

### Entities

#### StickerPack
```typescript
{
  id: UUID
  name: string
  author: string | null
  isOfficial: boolean
  coverUrl: string | null
  stickerCount: number
  stickers: Sticker[]
  createdAt: Date
}
```

#### Sticker
```typescript
{
  id: UUID
  packId: UUID
  name: string
  fileUrl: string
  thumbnailUrl: string | null
  tags: string[]
  pack: StickerPack
  createdAt: Date
}
```

### Message Types

The module extends the existing `MessageType` enum with two new types:

```typescript
export enum MessageType {
  TEXT = 'text',
  TRANSFER = 'transfer',
  SYSTEM = 'system',
  STICKER = 'sticker',      // New
  GIF = 'gif',              // New
}
```

## API Endpoints

### Sticker Endpoints

#### Get All Sticker Packs
```http
GET /stickers/packs?page=1&limit=10
```

Response:
```json
{
  "data": [
    {
      "id": "pack-uuid",
      "name": "Emotions",
      "author": "Official",
      "isOfficial": true,
      "coverUrl": "https://cdn.example.com/cover.png",
      "stickerCount": 10,
      "createdAt": "2026-03-26T10:00:00Z",
      "stickers": [...]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

#### Get Official Sticker Packs
```http
GET /stickers/packs/official?page=1&limit=10
```

#### Get Sticker Pack by ID
```http
GET /stickers/packs/{id}
```

#### Get Single Sticker
```http
GET /stickers/{id}
```

#### Search Stickers
```http
GET /stickers/search?q=happy
```

Returns stickers matching the query in name or tags (up to 50 results).

#### Create Official Pack (Admin)
```http
POST /stickers/packs
Content-Type: application/json

{
  "name": "New Pack",
  "author": "Pack Creator",
  "isOfficial": true,
  "coverUrl": "https://cdn.example.com/cover.png"
}
```

#### Add Sticker to Pack (Admin)
```http
POST /stickers
Content-Type: application/json

{
  "packId": "pack-uuid",
  "name": "Happy Emoji",
  "fileUrl": "https://cdn.example.com/sticker.webp",
  "thumbnailUrl": "https://cdn.example.com/thumb.png",
  "tags": ["happy", "emoji", "yellow"]
}
```

### GIF Endpoints

#### Search GIFs
```http
GET /gifs/search?q=happy&limit=10
```

Response:
```json
[
  {
    "id": "gif-tenor-id",
    "title": "Happy Dance",
    "webmUrl": "https://media.tenor.com/happy.webm",
    "mp4Url": "https://media.tenor.com/happy.mp4",
    "gifUrl": "https://media.tenor.com/happy.gif",
    "mediaUrl": "https://media.tenor.com/happy.webm",
    "thumbnailUrl": "https://media.tenor.com/happy-tiny.gif"
  }
]
```

## Configuration

### Environment Variables

```bash
# Tenor API Key (required for GIF search)
TENOR_API_KEY=your-tenor-api-key-here

# Cache Settings (optional, defaults provided)
REDIS_URL=redis://localhost:6379
```

## Service Methods

### StickersService

#### `getStickerPacks(pagination: PaginationDto): Promise<PaginatedResponse<StickerPackResponseDto>>`
Get all sticker packs with pagination and 10-minute cache.

#### `getOfficialStickerPacks(pagination: PaginationDto): Promise<PaginatedResponse<StickerPackResponseDto>>`
Get only official sticker packs with 10-minute cache.

#### `getPackStickers(packId: string): Promise<StickerPackResponseDto>`
Get a specific sticker pack with all its stickers and 10-minute cache.

#### `getSticker(stickerId: string): Promise<StickerResponseDto>`
Get a single sticker by ID.

#### `searchStickers(query: string): Promise<StickerResponseDto[]>`
Search stickers by name and tags. Throws `BadRequestException` if query is empty.

#### `searchGIFs(q: string, limit?: number): Promise<GifResultDto[]>`
Search GIFs from Tenor API with 5-minute cache. Returns empty array if API key is missing or API fails.

#### `addOfficialPack(createDto: CreateStickerPackDto): Promise<StickerPackResponseDto>`
Create a new official sticker pack and clear cache.

#### `addStickerToPack(createDto: CreateStickerDto): Promise<StickerResponseDto>`
Add a new sticker to an existing pack and update pack's sticker count.

## Database Schema

### sticker_packs table
- `id` (UUID, PK)
- `name` (VARCHAR 100)
- `author` (VARCHAR 100, nullable)
- `isOfficial` (BOOLEAN)
- `coverUrl` (TEXT, nullable)
- `stickerCount` (INT)
- `createdAt` (TIMESTAMP)

Indexes:
- `idx_sticker_packs_name` on `name`
- `idx_sticker_packs_is_official` on `isOfficial`

### stickers table
- `id` (UUID, PK)
- `packId` (UUID, FK)
- `name` (VARCHAR 100)
- `fileUrl` (TEXT)
- `thumbnailUrl` (TEXT, nullable)
- `tags` (TEXT[], simple-array)
- `createdAt` (TIMESTAMP)

Indexes:
- `idx_stickers_pack_id` on `packId`

## Caching Strategy

### Sticker Packs (10 min TTL)
- Cache key: `sticker_packs:all:{page}:{limit}`
- Invalidated on: Pack creation

### Official Sticker Packs (10 min TTL)
- Cache key: `sticker_packs:official:{page}:{limit}`
- Invalidated on: Pack creation

### Single Sticker Pack (10 min TTL)
- Cache key: `sticker_pack:{packId}`
- Invalidated on: Sticker addition

### GIF Search Results (5 min TTL)
- Cache key: `gifs:search:{query}:{limit}`
- Automatic expiration after 5 minutes

## Usage in Messages

To send a sticker or GIF in a conversation, create a message with the appropriate type:

### Send Sticker
```typescript
// In your messages service
const message = {
  conversationId: 'conv-uuid',
  senderId: 'user-uuid',
  type: MessageType.STICKER,  // Extended enum
  content: 'sticker-id-uuid'  // Reference to sticker
};
```

### Send GIF
```typescript
const message = {
  conversationId: 'conv-uuid',
  senderId: 'user-uuid',
  type: MessageType.GIF,      // Extended enum
  content: JSON.stringify({
    id: 'tenor-gif-id',
    title: 'Happy',
    gifUrl: 'https://media.tenor.com/happy.gif'
  })
};
```

## Testing

Run unit tests:
```bash
npm test -- stickers.service.spec.ts
npm test -- stickers.controller.spec.ts
```

Run with coverage:
```bash
npm test:cov -- stickers/
```

Expected coverage: >=85%

## CDN Integration

### Pre-loading Sticker Packs to CDN

Sticker pack assets should be uploaded to your CDN during deployment:

1. Define sticker pack data in a deployment script
2. Upload WebP/PNG files to CDN
3. Create StickerPack entities with CDN URLs
4. Use `addOfficialPack()` endpoint to register packs

Example deployment script:
```bash
#!/bin/bash
# Upload sticker assets to CDN
aws s3 cp stickers/ s3://your-bucket/stickers/ --recursive

# Seed official packs using API
curl -X POST http://localhost:3000/stickers/packs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Official Pack",
    "author": "Your App",
    "isOfficial": true,
    "coverUrl": "https://cdn.yourapp.com/stickers/pack-cover.png"
  }'
```

## Performance Considerations

1. **Pagination**: Always use pagination for pack lists (default: page=1, limit=10)
2. **Caching**: GIF search results are cached for 5 minutes to reduce Tenor API calls
3. **Indexing**: Database queries use indexes on frequently searched fields
4. **Limit**: GIF search results are limited to 50 maximum
5. **Repository Queries**: Use specific repository methods to avoid N+1 queries

## Error Handling

- `NotFoundException`: Thrown when sticker/pack not found
- `BadRequestException`: Thrown for invalid queries or missing parameters
- `Logger.error()`: API errors are logged without failing - service returns empty array

## Security Considerations

1. **Admin Endpoints**: `/stickers/packs (POST)` and `/stickers (POST)` should be protected by admin middleware
2. **Input Validation**: All DTOs use class-validator for input validation
3. **Rate Limiting**: Apply throttling to GIF search endpoint due to API costs
4. **API Key**: Store TENOR_API_KEY in environment variables, never hardcode

## Migration Guide

If migrating from old sticker system:

1. Create migration to add Sticker and StickerPack entities
2. Run database migrations
3. Use import script to populate existing stickers
4. Update message type handling to support STICKER and GIF types
5. Update frontend to use new endpoints

## Future Enhancements

- [ ] Sticker pack ratings and reviews
- [ ] User custom sticker pack creation
- [ ] Sticker analytics (most used, trending)
- [ ] Giphy integration alongside Tenor
- [ ] Animated pack preview generation
- [ ] Bulk sticker pack upload
- [ ] Sticker pack versioning
