import { Buffer } from 'buffer';

// @ts-ignore
if (typeof globalThis !== 'undefined') {
    // @ts-ignore
    globalThis.Buffer = Buffer;
} else if (typeof global !== 'undefined') {
    // @ts-ignore
    global.Buffer = Buffer;
} else if (typeof window !== 'undefined') {
    // @ts-ignore
    window.Buffer = Buffer;
}
