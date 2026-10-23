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

    // ── Scenarios page ────────────────────────────────────────────
    scenarioLoading: 'Loading scenarios…',
    scenarioEmpty: 'No scenarios are available right now.',
    scenarioStart: 'Start',
    scenarioStarting: 'Starting…',
    scenarioAboutMinutes: 'About {minutes} min',
    scenarioChooseLanguage: 'Choose a language',
    scenarioLanguageEnglish: 'EN',
    scenarioLanguageAmharic: 'አማርኛ',
    scenarioLanguageUnavailable: 'Not available in this language yet.',
    scenarioChannelCall: 'Call',
    scenarioChannelTelegram: 'Telegram',
    scenarioChannelMessage: 'Message',

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

    // ── Shared form elements ──────────────────────────────────────
    fieldEmail:             'Email address',
    fieldPassword:          'Password',
    fieldName:              'Full name',
    actionSubmit:           'Submit',
    statusPleaseWait:       'Please wait…',

    // ── Validation messages ───────────────────────────────────────
    validEmailRequired:     'Please enter a valid email address.',
    validPasswordRequired:  'Password must be at least 8 characters.',
    validPasswordTooLong:   'Password must be 72 characters or fewer.',
    validNameRequired:      'Name must be at least 2 characters.',
    validNameTooLong:       'Name must be 60 characters or fewer.',
    validFieldInvalid:      'This field is invalid.',

    // ── Login page ────────────────────────────────────────────────
    loginSubmit:            'Log in',
    loginNoAccount:         'No account?',
    loginRegisterLink:      'Register',

    // ── Register page — account type selector ─────────────────────
    registerTypeIndividual: 'Individual',
    registerTypeCreate:     'Create organization',
    registerTypeJoin:       'Join organization',

    // ── Register page — fields ────────────────────────────────────
    fieldOrgName:           'Organization name',
    fieldJoinCode:          'Join code',

    // ── Register page — field validation ─────────────────────────
    validOrgNameRequired:   'Organization name must be at least 2 characters.',
    validOrgNameTooLong:    'Organization name must be 60 characters or fewer.',
    validJoinCodeRequired:  'Join code must be exactly 6 characters.',

    // ── Register page — submit ────────────────────────────────────
    registerSubmit:         'Create account',
    registerHaveAccount:    'Already have an account?',
    registerLoginLink:      'Log in',

    // ── Register success panel (orgAdmin) ─────────────────────────
    registerSuccessHeading: 'Organization created!',
    registerSuccessBody:    'Share this code with your employees so they can join your organization:',
    registerCopyCode:       'Copy code',
    registerCopied:         'Copied!',
    registerContinue:       'Continue to Scenarios',

    // ── Demo notice ───────────────────────────────────────────────
    demoNotice: 'Demo notice: chats may be processed and reviewed by the AI provider. Do not share anything private.',
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

    // ── Scenarios page ────────────────────────────────────────────
    scenarioLoading: 'ሁኔታዎች በመጫን ላይ…',
    scenarioEmpty: 'አሁን ምንም ሁኔታዎች የሉም።',
    scenarioStart: 'ጀምር',
    scenarioStarting: 'በመጀመር ላይ…',
    scenarioAboutMinutes: 'ወደ {minutes} ደቂቃ',
    scenarioChooseLanguage: 'ቋንቋ ይምረጡ',
    scenarioLanguageEnglish: 'EN',
    scenarioLanguageAmharic: 'አማርኛ',
    scenarioLanguageUnavailable: 'ይህ ቋንቋ ገና አይገኝም።',
    scenarioChannelCall: 'ስልክ ጥሪ',
    scenarioChannelTelegram: 'ቴሌግራም',
    scenarioChannelMessage: 'መልዕክት',

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

    // ── Shared form elements ──────────────────────────────────────
    fieldEmail:             'ኢሜይል አድራሻ',
    fieldPassword:          'የይለፍ ቃል',
    fieldName:              'ሙሉ ስም',
    actionSubmit:           'አስገባ',
    statusPleaseWait:       'እባክዎ ይጠብቁ…',

    // ── Validation messages ───────────────────────────────────────
    validEmailRequired:     'እባክዎ ትክክለኛ ኢሜይል አድራሻ ያስገቡ።',
    validPasswordRequired:  'የይለፍ ቃሉ ቢያንስ 8 ቁምፊዎች መሆን አለበት።',
    validPasswordTooLong:   'የይለፍ ቃሉ ከ72 ቁምፊዎች ማለፍ የለበትም።',
    validNameRequired:      'ስሙ ቢያንስ 2 ቁምፊዎች መሆን አለበት።',
    validNameTooLong:       'ስሙ ከ60 ቁምፊዎች ማለፍ የለበትም።',
    validFieldInvalid:      'ይህ መስክ ልክ አይደለም።',

    // ── Login page ────────────────────────────────────────────────
    loginSubmit:            'ግባ',
    loginNoAccount:         'መለያ የለዎትም?',
    loginRegisterLink:      'ተመዝገብ',

    // ── Register page — account type selector ─────────────────────
    registerTypeIndividual: 'ግለሰብ',
    registerTypeCreate:     'ድርጅት ፍጠር',
    registerTypeJoin:       'ድርጅት ተቀላቀል',

    // ── Register page — fields ────────────────────────────────────
    fieldOrgName:           'የድርጅት ስም',
    fieldJoinCode:          'የመቀላቀያ ኮድ',

    // ── Register page — field validation ─────────────────────────
    validOrgNameRequired:   'የድርጅት ስም ቢያንስ 2 ቁምፊዎች መሆን አለበት።',
    validOrgNameTooLong:    'የድርጅት ስም ከ60 ቁምፊዎች ማለፍ የለበትም።',
    validJoinCodeRequired:  'የመቀላቀያ ኮድ ትክክለኛ 6 ቁምፊዎች መሆን አለበት።',

    // ── Register page — submit ────────────────────────────────────
    registerSubmit:         'መለያ ፍጠር',
    registerHaveAccount:    'አስቀድሞ መለያ አለዎት?',
    registerLoginLink:      'ግባ',

    // ── Register success panel (orgAdmin) ─────────────────────────
    registerSuccessHeading: 'ድርጅቱ ተፈጥሯል!',
    registerSuccessBody:    'ሠራተኞችዎ ድርጅቱን እንዲቀላቀሉ ይህን ኮድ ያጋሩ:',
    registerCopyCode:       'ኮድ ቅዳ',
    registerCopied:         'ተቀድቷል!',
    registerContinue:       'ወደ ሁኔታዎች ቀጥል',

    // ── Demo notice ───────────────────────────────────────────────
    demoNotice: 'የማሳያ ማስታወቂያ: ቻቶች በ AI አቅራቢ ሊቀናበሩ እና ሊገመገሙ ይችላሉ። ግላዊ መረጃ አያጋሩ።',
  },
}
