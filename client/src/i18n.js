/**
 * BaitCheck i18n strings
 * Amharic (am) values are written for native-reader review.
 *
 * Error code keys follow the pattern: error_CODE
 * matching every code in CONTEXT.md plus client-only codes.
 */
export const strings = {
  en: {
    // ── App ──────────────────────────────────────────────────────
    appName: 'BaitCheck',

    // ── Nav labels ───────────────────────────────────────────────
    navScenarios: 'Scenarios',
    navHistory:   'History',
    navAdmin:     'Admin',
    navLogin:     'Login',
    navRegister:  'Register',
    navLogout:    'Logout',

    // ── Page headings ────────────────────────────────────────────
    headingLogin:     'Login',
    headingRegister:  'Register',
    headingScenarios: 'Scenarios',
    headingChat:      'Chat',
    headingReport:    'Report',
    headingHistory:   'History',
    headingAdmin:     'Admin',

    // ── Auth / status UI ─────────────────────────────────────────
    statusLoading:          'Loading…',
    errorCannotReachServer: 'Cannot reach the server. Please check your connection.',
    actionRetry:            'Retry',
    errorNoPermission:      'You do not have permission to view this page.',
    navUserLabel:           'Logged in as',
    actionLogout:           'Logout',

    // ── Error codes (from CONTEXT.md + client-only) ───────────────
    // 400
    error_VALIDATION_ERROR:   'One or more fields are invalid. Please check your input.',
    error_INVALID_JOIN_CODE:  'The join code you entered is not valid.',
    // 401
    error_UNAUTHORIZED:       'Your session has expired. Please log in again.',
    error_INVALID_CREDENTIALS:'Incorrect email or password.',
    // 403
    error_FORBIDDEN:          'You do not have permission to do that.',
    // 404
    error_NOT_FOUND:          'The requested item could not be found.',
    // 409
    error_EMAIL_TAKEN:        'An account with that email address already exists.',
    error_SESSION_FINISHED:   'This session has already been finished.',
    // 429
    error_RATE_LIMITED:       'Too many requests. Please wait a moment and try again.',
    // 502
    error_LLM_FAILED:         'The AI service encountered an error. Please try again.',
    // 503
    error_LLM_BUSY:           'The AI service is currently busy. Please try again shortly.',
    // 500
    error_SERVER_ERROR:       'An unexpected server error occurred.',
    // Client-only
    error_NETWORK_ERROR:      'Could not connect to the server. Check your internet connection.',
    // Generic fallback (unknown code)
    errorGeneric:             'Something went wrong. Please try again.',
  },

  am: {
    // ── App ──────────────────────────────────────────────────────
    appName: 'ቤይትቼክ',

    // ── Nav labels ───────────────────────────────────────────────
    navScenarios: 'ሁኔታዎች',
    navHistory:   'ታሪክ',
    navAdmin:     'አስተዳዳሪ',
    navLogin:     'ግባ',
    navRegister:  'ተመዝገብ',
    navLogout:    'ውጣ',

    // ── Page headings ────────────────────────────────────────────
    headingLogin:     'ግባ',
    headingRegister:  'ተመዝገብ',
    headingScenarios: 'ሁኔታዎች',
    headingChat:      'ቻት',
    headingReport:    'ሪፖርት',
    headingHistory:   'ታሪክ',
    headingAdmin:     'አስተዳዳሪ',

    // ── Auth / status UI ─────────────────────────────────────────
    statusLoading:          'በመጫን ላይ…',
    errorCannotReachServer: 'አገልጋዩን ማግኘት አልተቻለም። ግንኙነትዎን ያረጋግጡ።',
    actionRetry:            'እንደገና ሞክር',
    errorNoPermission:      'ይህን ገጽ የማየት ፈቃድ የለዎትም።',
    navUserLabel:           'የገቡት',
    actionLogout:           'ውጣ',

    // ── Error codes ───────────────────────────────────────────────
    error_VALIDATION_ERROR:   'አንድ ወይም ከዛ በላይ መስኮች ትክክለኛ አይደሉም። ግቤቶን ያረጋግጡ።',
    error_INVALID_JOIN_CODE:  'ያስገቡት ኮድ ልክ አይደለም።',
    error_UNAUTHORIZED:       'ስብሰባዎ አብቅቷል። እንደገና ይግቡ።',
    error_INVALID_CREDENTIALS:'ኢሜይል ወይም የይለፍ ቃል ስህተት ነው።',
    error_FORBIDDEN:          'ይህንን ለማድረግ ፈቃድ የለዎትም።',
    error_NOT_FOUND:          'የተጠየቀው ንጥረ ነገር አልተገኘም።',
    error_EMAIL_TAKEN:        'በዚህ ኢሜይል አድራሻ የተመዘገበ መለያ አስቀድሞ አለ።',
    error_SESSION_FINISHED:   'ይህ ክፍለ ጊዜ አስቀድሞ ተጠናቋል።',
    error_RATE_LIMITED:       'ብዙ ጥያቄዎች። ትንሽ ጠብቀው እንደገና ይሞክሩ።',
    error_LLM_FAILED:         'የ AI አገልግሎት ስህተት ተፈጥሯል። እንደገና ይሞክሩ።',
    error_LLM_BUSY:           'የ AI አገልግሎት አሁን ተጠምዷል። ትንሽ ቆይተው ይሞክሩ።',
    error_SERVER_ERROR:       'ያልተጠበቀ የአገልጋይ ስህተት ተፈጥሯል።',
    error_NETWORK_ERROR:      'ከአገልጋዩ ጋር ግንኙነት ማድረግ አልተቻለም። የኢንተርኔት ግንኙነትዎን ያረጋግጡ።',
    errorGeneric:             'ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
  },
}
