
import { TextEncoder, TextDecoder } from 'util'

// Polyfill globals required by jsdom/whatwg-url
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
