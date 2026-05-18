// Workaround for https://github.com/unovue/reka-ui/issues/1280
// Reka imports hideOthers, but suppressOthers prefers inert where supported.
export { inertOthers, supportsInert, suppressOthers } from 'aria-hidden/dist/es2015/index.js'
export { suppressOthers as hideOthers } from 'aria-hidden/dist/es2015/index.js'
