/*
 * i18n/translations.js
 * ---------------------------------------------------------------
 * Every user-facing string in AGROBRIDGE, in four languages:
 *   hi  हिन्दी     (default)
 *   en  English
 *   pa  ਪੰਜਾਬੀ
 *   mr  मराठी
 *
 * Usage:   tr('gatePass.title')
 *          tr('queue.ahead', { n: 3 })     ->  "{n}" is replaced
 *
 * Keys are grouped by screen/feature with a dot prefix.
 * Add a key here first, then use it in the screen.
 * ---------------------------------------------------------------
 */

export const DEFAULT_LANG = 'hi';

export const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

// Short helper so each row is one readable line: r(hi, en, pa, mr)
const r = (hi, en, pa, mr) => ({ hi, en, pa, mr });

export const t = {
  /* ------------------------------------------------------------ */
  /* Brand / common                                                */
  /* ------------------------------------------------------------ */
  brand: r('AgroBridge', 'AgroBridge', 'AgroBridge', 'AgroBridge'),
  brandSub: r('स्मार्ट मंडी खरीद', 'Smart Procurement', 'ਸਮਾਰਟ ਮੰਡੀ ਖਰੀਦ', 'स्मार्ट खरेदी'),
  appLoading: r('ऐप तैयार हो रहा है...', 'Getting the app ready...', 'ਐਪ ਤਿਆਰ ਹੋ ਰਹੀ ਹੈ...', 'अ‍ॅप तयार होत आहे...'),
  listen: r('सुनें', 'Listen', 'ਸੁਣੋ', 'ऐका'),
  selectLanguage: r('भाषा बदलें', 'Select Language', 'ਭਾਸ਼ਾ ਬਦਲੋ', 'भाषा बदला'),

  getStarted: r('शुरू करें', 'Get Started', 'ਸ਼ੁਰੂ ਕਰੋ', 'सुरू करा'),
  continue: r('आगे बढ़ें', 'Continue', 'ਅੱਗੇ ਵਧੋ', 'पुढे जा'),
  back: r('वापस', 'Back', 'ਵਾਪਸ', 'मागे'),
  goBack: r('वापस जाएं', 'Go Back', 'ਵਾਪਸ ਜਾਓ', 'मागे जा'),
  logout: r('लॉग आउट', 'Log Out', 'ਲੌਗ ਆਊਟ', 'लॉग आउट'),
  logoutConfirm: r('लॉग आउट करें?', 'Log out?', 'ਲੌਗ ਆਊਟ ਕਰੀਏ?', 'लॉग आउट करायचे?'),
  cancel: r('रद्द करें', 'Cancel', 'ਰੱਦ ਕਰੋ', 'रद्द करा'),
  confirm: r('पुष्टि करें', 'Confirm', 'ਪੁਸ਼ਟੀ ਕਰੋ', 'पुष्टी करा'),
  save: r('सहेजें', 'Save', 'ਸੰਭਾਲੋ', 'जतन करा'),
  saved: r('सहेजा गया', 'Saved', 'ਸੰਭਾਲਿਆ ਗਿਆ', 'जतन केले'),
  ok: r('ठीक', 'OK', 'ਠੀਕ', 'ठीक'),
  yes: r('हाँ', 'Yes', 'ਹਾਂ', 'होय'),
  no: r('नहीं', 'No', 'ਨਹੀਂ', 'नाही'),
  error: r('त्रुटि', 'Error', 'ਗਲਤੀ', 'त्रुटी'),
  done: r('हो गया', 'Done', 'ਹੋ ਗਿਆ', 'झाले'),
  tapToRetry: r('दोबारा प्रयास करने के लिए टैप करें', 'Tap to retry', 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਲਈ ਟੈਪ ਕਰੋ', 'पुन्हा प्रयत्नासाठी टॅप करा'),
  login: r('लॉग इन', 'Login', 'ਲੌਗਇਨ', 'लॉगिन'),
  register: r('नया खाता बनाएं', 'Create Account', 'ਨਵਾਂ ਖਾਤਾ ਬਣਾਓ', 'नवीन खाते तयार करा'),
  sendOtp: r('ओटीपी भेजें', 'Send OTP', 'OTP ਭੇਜੋ', 'OTP पाठवा'),
  verifyOtp: r('सत्यापित करें', 'Verify & Proceed', 'ਪੁਸ਼ਟੀ ਕਰੋ', 'सत्यापित करा'),
  namaste: r('नमस्ते', 'Namaste', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'नमस्कार'),
  quintal: r('क्विंटल', 'quintal', 'ਕੁਇੰਟਲ', 'क्विंटल'),
  quintalShort: r('क्विं.', 'qtl', 'ਕੁਇੰ.', 'क्विं.'),
  perQuintal: r('/ क्विंटल', '/ quintal', '/ ਕੁਇੰਟਲ', '/ क्विंटल'),
  minutes: r('मिनट', 'min', 'ਮਿੰਟ', 'मिनिटे'),
  hours: r('घंटे', 'hr', 'ਘੰਟੇ', 'तास'),
  today: r('आज', 'Today', 'ਅੱਜ', 'आज'),
  tomorrow: r('कल', 'Tomorrow', 'ਕੱਲ੍ਹ', 'उद्या'),
  vehicle: r('वाहन', 'Vehicle', 'ਵਾਹਨ', 'वाहन'),
  vehicleNumber: r('वाहन नंबर', 'Vehicle Number', 'ਵਾਹਨ ਨੰਬਰ', 'वाहन क्रमांक'),
  vehiclePending: r('वाहन लंबित', 'Vehicle pending', 'ਵਾਹਨ ਬਾਕੀ', 'वाहन प्रलंबित'),
  crop: r('फसल', 'Crop', 'ਫਸਲ', 'पीक'),
  farmer: r('किसान', 'Farmer', 'ਕਿਸਾਨ', 'शेतकरी'),
  mandi: r('मंडी', 'Mandi', 'ਮੰਡੀ', 'मंडी'),
  date: r('तारीख', 'Date', 'ਤਾਰੀਖ', 'तारीख'),
  time: r('समय', 'Time', 'ਸਮਾਂ', 'वेळ'),
  grade: r('ग्रेड', 'Grade', 'ਗ੍ਰੇਡ', 'ग्रेड'),
  moisture: r('नमी', 'Moisture', 'ਨਮੀ', 'ओलावा'),
  foreignMatter: r('अन्य पदार्थ', 'Foreign matter', 'ਹੋਰ ਪਦਾਰਥ', 'इतर पदार्थ'),
  quantity: r('मात्रा', 'Quantity', 'ਮਾਤਰਾ', 'प्रमाण'),
  approxQuantity: r('अनुमानित मात्रा', 'Approx. quantity', 'ਅਨੁਮਾਨਿਤ ਮਾਤਰਾ', 'अंदाजे प्रमाण'),
  rate: r('दर', 'Rate', 'ਦਰ', 'दर'),
  price: r('भाव', 'Price', 'ਭਾਅ', 'भाव'),
  mobile: r('मोबाइल', 'Mobile', 'ਮੋਬਾਈਲ', 'मोबाइल'),
  name: r('नाम', 'Name', 'ਨਾਮ', 'नाव'),
  address: r('पता', 'Address', 'ਪਤਾ', 'पत्ता'),
  token: r('टोकन', 'Token', 'ਟੋਕਨ', 'टोकन'),
  lot: r('लॉट', 'Lot', 'ਲਾਟ', 'लॉट'),
  msp: r('MSP', 'MSP', 'MSP', 'MSP'),
  notes: r('टिप्पणी', 'Notes', 'ਟਿੱਪਣੀ', 'टीप'),
  optional: r('वैकल्पिक', 'optional', 'ਵਿਕਲਪਿਕ', 'ऐच्छिक'),
  pleaseRetry: r('कृपया दोबारा प्रयास करें।', 'Please try again.', 'ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', 'कृपया पुन्हा प्रयत्न करा.'),
  loginRequired: r('लॉग इन आवश्यक', 'Login required', 'ਲੌਗਇਨ ਜ਼ਰੂਰੀ', 'लॉगिन आवश्यक'),
  loginAgain: r('कृपया दोबारा लॉग इन करें।', 'Please log in again.', 'ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਲੌਗਇਨ ਕਰੋ।', 'कृपया पुन्हा लॉगिन करा.'),
  pdfFailed: r('PDF नहीं बना', 'Could not create PDF', 'PDF ਨਹੀਂ ਬਣੀ', 'PDF तयार झाली नाही'),
  notSaved: r('सहेजा नहीं जा सका।', 'Could not save.', 'ਸੰਭਾਲ ਨਹੀਂ ਸਕੇ।', 'जतन करता आले नाही.'),
  notRecorded: r('दर्ज नहीं हुआ।', 'Could not record.', 'ਦਰਜ ਨਹੀਂ ਹੋਇਆ।', 'नोंद झाली नाही.'),
  recorded: r('दर्ज हो गया', 'Recorded', 'ਦਰਜ ਹੋ ਗਿਆ', 'नोंद झाली'),
  noneFound: r('कोई मंडी नहीं मिली।', 'No mandi found.', 'ਕੋਈ ਮੰਡੀ ਨਹੀਂ ਮਿਲੀ।', 'मंडी सापडली नाही.'),
  noneFoundContactAdmin: r('कोई मंडी नहीं मिली। कृपया व्यवस्थापक से संपर्क करें।', 'No mandi found. Please contact the administrator.', 'ਕੋਈ ਮੰਡੀ ਨਹੀਂ ਮਿਲੀ। ਪ੍ਰਬੰਧਕ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।', 'मंडी सापडली नाही. कृपया प्रशासकाशी संपर्क साधा.'),

  /* ------------------------------------------------------------ */
  /* Welcome / role / auth                                         */
  /* ------------------------------------------------------------ */
  welcome_headline: r('स्मार्ट मंडी खरीद', 'Smart Mandi Procurement', 'ਸਮਾਰਟ ਮੰਡੀ ਖਰੀਦ', 'स्मार्ट मंडी खरेदी'),
  welcome_sub: r('बिना लाइन, बिना इंतजार', 'No queues, no waiting', 'ਨਾ ਲਾਈਨ, ਨਾ ਉਡੀਕ', 'रांग नाही, प्रतीक्षा नाही'),
  welcome_footer: r('कृषि मंत्रालय आधारित डिजिटल मंडी पहल', 'A digital mandi initiative', 'ਡਿਜੀਟਲ ਮੰਡੀ ਪਹਿਲ', 'डिजिटल मंडी उपक्रम'),

  selectRole: r('अपनी भूमिका चुनें', 'Select Your Role', 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ', 'तुमची भूमिका निवडा'),
  roleFarmer: r('किसान', 'Farmer', 'ਕਿਸਾਨ', 'शेतकरी'),
  roleFarmerSub: r('गेट स्लॉट बुक करें, कतार टोकन देखें और बैंक रसीद पाएं', 'Book gate slots, track queue tokens & get receipts', 'ਗੇਟ ਸਲਾਟ ਬੁੱਕ ਕਰੋ, ਟੋਕਨ ਵੇਖੋ ਅਤੇ ਰਸੀਦ ਲਓ', 'गेट स्लॉट बुक करा, टोकन पहा व पावती मिळवा'),
  roleOfficer: r('मंडी अधिकारी / स्टाफ', 'Mandi Officer / Staff', 'ਮੰਡੀ ਅਧਿਕਾਰੀ / ਸਟਾਫ', 'मंडी अधिकारी / कर्मचारी'),
  roleOfficerSub: r('गेट प्रवेश, जांच, तौल और भुगतान प्रबंधन', 'Manage gate entry, assay, weighing & payments', 'ਗੇਟ ਐਂਟਰੀ, ਜਾਂਚ, ਤੋਲ ਅਤੇ ਭੁਗਤਾਨ', 'गेट प्रवेश, तपासणी, वजन व पेमेंट व्यवस्थापन'),
  roleTrader: r('व्यापारी / आढ़तिया', 'Trader / Buyer', 'ਵਪਾਰੀ / ਆੜ੍ਹਤੀਆ', 'व्यापारी / खरेदीदार'),
  roleTraderSub: r('नीलामी में बोली लगाएं और खरीदी गई फसल देखें', 'Bid in live auctions & track your purchases', 'ਨੀਲਾਮੀ ਵਿੱਚ ਬੋਲੀ ਲਗਾਓ ਅਤੇ ਖਰੀਦ ਵੇਖੋ', 'लिलावात बोली लावा व खरेदी पहा'),

  status_title: r('खाता विकल्प', 'Account', 'ਖਾਤਾ ਵਿਕਲਪ', 'खाते पर्याय'),
  status_sub: r('लॉग इन या नया पंजीकरण', 'Log in or register', 'ਲੌਗਇਨ ਜਾਂ ਨਵੀਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ', 'लॉगिन किंवा नवीन नोंदणी'),
  status_loginSub: r('पंजीकृत मोबाइल से लॉग इन', 'Log in with registered mobile', 'ਰਜਿਸਟਰਡ ਮੋਬਾਈਲ ਨਾਲ ਲੌਗਇਨ', 'नोंदणीकृत मोबाइलने लॉगिन'),
  status_registerSub: r('नया पंजीकरण', 'New registration', 'ਨਵੀਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ', 'नवीन नोंदणी'),

  login_title: r('मोबाइल लॉग इन', 'Mobile Login', 'ਮੋਬਾਈਲ ਲੌਗਇਨ', 'मोबाइल लॉगिन'),
  login_sub: r('पंजीकृत मोबाइल से लॉग इन करें', 'Log in with your registered mobile', 'ਰਜਿਸਟਰਡ ਮੋਬਾਈਲ ਨਾਲ ਲੌਗਇਨ ਕਰੋ', 'नोंदणीकृत मोबाइलने लॉगिन करा'),
  login_mobile: r('मोबाइल नंबर', 'Mobile number', 'ਮੋਬਾਈਲ ਨੰਬਰ', 'मोबाइल क्रमांक'),
  login_badNumber: r('गलत नंबर', 'Invalid number', 'ਗਲਤ ਨੰਬਰ', 'चुकीचा क्रमांक'),
  login_badNumberSub: r('कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।', 'Please enter a 10-digit mobile number.', '10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'कृपया 10 अंकी मोबाइल क्रमांक टाका.'),

  otp_title: r('ओटीपी सत्यापन', 'OTP Verification', 'OTP ਪੁਸ਼ਟੀ', 'OTP पडताळणी'),
  otp_test: r('टेस्ट मोड: OTP 1234', 'Test mode: OTP 1234', 'ਟੈਸਟ ਮੋਡ: OTP 1234', 'चाचणी मोड: OTP 1234'),
  otp_wrong: r('गलत OTP', 'Wrong OTP', 'ਗਲਤ OTP', 'चुकीचा OTP'),
  otp_wrongSub: r('टेस्ट मोड में OTP 1234 है।', 'In test mode the OTP is 1234.', 'ਟੈਸਟ ਮੋਡ ਵਿੱਚ OTP 1234 ਹੈ।', 'चाचणी मोडमध्ये OTP 1234 आहे.'),
  otp_verify: r('पुष्टि करें और आगे बढ़ें', 'Verify & continue', 'ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਅੱਗੇ ਵਧੋ', 'पुष्टी करा आणि पुढे जा'),
  otp_problem: r('समस्या', 'Problem', 'ਸਮੱਸਿਆ', 'समस्या'),
  otp_genericError: r('कुछ गलत हो गया। कृपया दोबारा प्रयास करें।', 'Something went wrong. Please try again.', 'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', 'काहीतरी चूक झाली. पुन्हा प्रयत्न करा.'),

  reg_title: r('नया खाता', 'New Account', 'ਨਵਾਂ ਖਾਤਾ', 'नवीन खाते'),
  reg_sub: r('अपना विवरण दर्ज करें', 'Enter your details', 'ਆਪਣਾ ਵੇਰਵਾ ਦਰਜ ਕਰੋ', 'तुमचा तपशील टाका'),
  reg_fullName: r('पूरा नाम *', 'Full name *', 'ਪੂਰਾ ਨਾਮ *', 'पूर्ण नाव *'),
  reg_mobile: r('मोबाइल *', 'Mobile *', 'ਮੋਬਾਈਲ *', 'मोबाइल *'),
  reg_tenDigits: r('10 अंक', '10 digits', '10 ਅੰਕ', '10 अंक'),
  reg_empId: r('कर्मचारी आईडी *', 'Employee ID *', 'ਕਰਮਚਾਰੀ ID *', 'कर्मचारी ID *'),
  reg_yourMandi: r('आपकी मंडी *', 'Your mandi *', 'ਤੁਹਾਡੀ ਮੰਡੀ *', 'तुमची मंडी *'),
  reg_yourMandiHelp: r('आप जिस मंडी में तैनात हैं वही चुनें। आपको केवल उसी मंडी के टोकन दिखाई देंगे।', 'Choose the mandi you are posted at. You will only see tokens from that mandi.', 'ਜਿਸ ਮੰਡੀ ਵਿੱਚ ਤੁਸੀਂ ਤਾਇਨਾਤ ਹੋ ਉਹੀ ਚੁਣੋ। ਤੁਹਾਨੂੰ ਸਿਰਫ਼ ਉਸੇ ਮੰਡੀ ਦੇ ਟੋਕਨ ਦਿਖਣਗੇ।', 'तुम्ही जिथे नियुक्त आहात ती मंडी निवडा. तुम्हाला फक्त त्याच मंडीचे टोकन दिसतील.'),
  reg_duty: r('ड्यूटी पद *', 'Duty *', 'ਡਿਊਟੀ *', 'कर्तव्य *'),
  reg_license: r('लाइसेंस नंबर *', 'Licence number *', 'ਲਾਇਸੈਂਸ ਨੰਬਰ *', 'परवाना क्रमांक *'),
  reg_licensePh: r('लाइसेंस नंबर', 'Licence number', 'ਲਾਇਸੈਂਸ ਨੰਬਰ', 'परवाना क्रमांक'),
  reg_firm: r('फर्म नाम *', 'Firm name *', 'ਫਰਮ ਦਾ ਨਾਮ *', 'फर्मचे नाव *'),
  reg_firmPh: r('फर्म का नाम', 'Firm name', 'ਫਰਮ ਦਾ ਨਾਮ', 'फर्मचे नाव'),
  reg_tradeMandi: r('व्यापार की मंडी *', 'Trading mandi *', 'ਵਪਾਰ ਦੀ ਮੰਡੀ *', 'व्यापाराची मंडी *'),
  reg_tradeMandiHelp: r('जिस मंडी में आपका लाइसेंस है वही चुनें। आपको उसी मंडी की नीलामी दिखेंगी।', 'Choose the mandi your licence is for. You will see auctions from that mandi.', 'ਜਿਸ ਮੰਡੀ ਦਾ ਲਾਇਸੈਂਸ ਹੈ ਉਹੀ ਚੁਣੋ। ਤੁਹਾਨੂੰ ਉਸੇ ਮੰਡੀ ਦੀ ਨੀਲਾਮੀ ਦਿਖੇਗੀ।', 'ज्या मंडीचा परवाना आहे ती निवडा. तुम्हाला त्याच मंडीचे लिलाव दिसतील.'),
  reg_goOtp: r('ओटीपी पर जाएं', 'Continue to OTP', 'OTP ਤੇ ਜਾਓ', 'OTP कडे जा'),

  /* ------------------------------------------------------------ */
  /* Duties (officer)                                              */
  /* ------------------------------------------------------------ */
  duty_gate: r('गेट अधिकारी (Gate Entry)', 'Gate Officer', 'ਗੇਟ ਅਧਿਕਾਰੀ', 'गेट अधिकारी'),
  duty_gate_desc: r('गेट आगमन और वाहन प्रविष्टि', 'Gate arrival & vehicle entry', 'ਗੇਟ ਆਮਦ ਅਤੇ ਵਾਹਨ ਐਂਟਰੀ', 'गेट आगमन व वाहन प्रवेश'),
  duty_assay: r('गुणवत्ता निरीक्षक (Assay / QC)', 'Quality Inspector (Assay / QC)', 'ਗੁਣਵੱਤਾ ਨਿਰੀਖਕ (ਜਾਂਚ)', 'गुणवत्ता निरीक्षक (तपासणी)'),
  duty_assay_desc: r('नमूना, नमी, ग्रेड तय करना', 'Sample, moisture, grade', 'ਨਮੂਨਾ, ਨਮੀ, ਗ੍ਰੇਡ', 'नमुना, ओलावा, ग्रेड'),
  duty_weighbridge: r('तौल अधिकारी (Weighbridge)', 'Weighbridge Officer', 'ਤੋਲ ਅਧਿਕਾਰੀ', 'वजन अधिकारी'),
  duty_weighbridge_desc: r('भाव तय होने के बाद वजन माप', 'Weighing after price is fixed', 'ਭਾਅ ਤੈਅ ਹੋਣ ਬਾਅਦ ਤੋਲ', 'भाव ठरल्यानंतर वजन'),
  duty_accounts: r('लेखा व भुगतान (Cashier)', 'Accounts & Payment (Cashier)', 'ਲੇਖਾ ਅਤੇ ਭੁਗਤਾਨ (ਕੈਸ਼ੀਅਰ)', 'लेखा व पेमेंट (कॅशियर)'),
  duty_accounts_desc: r('भुगतान और बैंक रसीद', 'Payment & bank receipt', 'ਭੁਗਤਾਨ ਅਤੇ ਬੈਂਕ ਰਸੀਦ', 'पेमेंट व बँक पावती'),
  duty_admin: r('मंडी प्रशासक (Admin)', 'Mandi Admin', 'ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ', 'मंडी प्रशासक'),
  duty_admin_desc: r('समस्त नियंत्रण व विलंब प्रबंधन', 'Full control & delay management', 'ਪੂਰਾ ਨਿਯੰਤਰਣ ਅਤੇ ਦੇਰੀ ਪ੍ਰਬੰਧਨ', 'संपूर्ण नियंत्रण व विलंब व्यवस्थापन'),
  dutyShort_gate: r('गेट अधिकारी', 'Gate Officer', 'ਗੇਟ ਅਧਿਕਾਰੀ', 'गेट अधिकारी'),
  dutyShort_assay: r('गुणवत्ता निरीक्षक', 'Quality Inspector', 'ਗੁਣਵੱਤਾ ਨਿਰੀਖਕ', 'गुणवत्ता निरीक्षक'),
  dutyShort_weighbridge: r('तौल अधिकारी', 'Weighbridge Officer', 'ਤੋਲ ਅਧਿਕਾਰੀ', 'वजन अधिकारी'),
  dutyShort_accounts: r('लेखा व भुगतान', 'Accounts', 'ਲੇਖਾ ਅਤੇ ਭੁਗਤਾਨ', 'लेखा व पेमेंट'),
  dutyShort_admin: r('मंडी प्रशासक', 'Mandi Admin', 'ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ', 'मंडी प्रशासक'),

  /* ------------------------------------------------------------ */
  /* Crops & grades                                                */
  /* ------------------------------------------------------------ */
  crop_wheat: r('गेहूँ', 'Wheat', 'ਕਣਕ', 'गहू'),
  crop_paddy: r('धान', 'Paddy', 'ਝੋਨਾ', 'भात'),
  crop_mustard: r('सरसों', 'Mustard', 'ਸਰ੍ਹੋਂ', 'मोहरी'),
  crop_cotton: r('कपास', 'Cotton', 'ਕਪਾਹ', 'कापूस'),
  crop_maize: r('मक्का', 'Maize', 'ਮੱਕੀ', 'मका'),
  crop_gram: r('चना', 'Gram', 'ਛੋਲੇ', 'हरभरा'),
  crop_tomato: r('टमाटर', 'Tomato', 'ਟਮਾਟਰ', 'टोमॅटो'),
  crop_onion: r('प्याज़', 'Onion', 'ਪਿਆਜ਼', 'कांदा'),
  grade_FAQ: r('FAQ', 'FAQ', 'FAQ', 'FAQ'),
  grade_GRADE_A: r('ग्रेड A', 'Grade A', 'ਗ੍ਰੇਡ A', 'ग्रेड A'),
  grade_GRADE_B: r('ग्रेड B', 'Grade B', 'ਗ੍ਰੇਡ B', 'ग्रेड B'),
  grade_REJECTED: r('अस्वीकृत', 'Rejected', 'ਅਸਵੀਕਾਰ', 'नाकारले'),

  /* ------------------------------------------------------------ */
  /* Booking statuses (badges)                                     */
  /* ------------------------------------------------------------ */
  st_booked: r('बुक', 'BOOKED', 'ਬੁੱਕ', 'बुक'),
  'st_in-gate': r('गेट अंदर', 'IN GATE', 'ਗੇਟ ਅੰਦਰ', 'गेटच्या आत'),
  st_assay: r('जांच पूरी', 'ASSAYED', 'ਜਾਂਚ ਪੂਰੀ', 'तपासणी पूर्ण'),
  'st_price-fixed': r('भाव तय', 'PRICE FIXED', 'ਭਾਅ ਤੈਅ', 'भाव निश्चित'),
  st_weighing: r('तौल', 'WEIGHED', 'ਤੋਲ', 'वजन'),
  'st_payment-processing': r('भुगतान बाकी', 'PAYMENT DUE', 'ਭੁਗਤਾਨ ਬਾਕੀ', 'पेमेंट बाकी'),
  st_paid: r('भुगतान', 'PAID', 'ਭੁਗਤਾਨ', 'पेमेंट'),
  st_rejected: r('अस्वीकृत', 'REJECTED', 'ਅਸਵੀਕਾਰ', 'नाकारले'),
  'st_no-show': r('अनुपस्थित', 'NO SHOW', 'ਗੈਰਹਾਜ਼ਰ', 'गैरहजर'),
  st_cancelled: r('रद्द', 'CANCELLED', 'ਰੱਦ', 'रद्द'),
  st_waitlisted: r('प्रतीक्षा', 'WAITLIST', 'ਉਡੀਕ', 'प्रतीक्षा'),
  st_appeared: r('मंडी में', 'AT MANDI', 'ਮੰਡੀ ਵਿੱਚ', 'मंडीत'),

  /* ------------------------------------------------------------ */
  /* Farmer dashboard                                              */
  /* ------------------------------------------------------------ */
  noActiveBooking: r('कोई सक्रिय बुकिंग नहीं', 'No Active Booking', 'ਕੋਈ ਸਰਗਰਮ ਬੁਕਿੰਗ ਨਹੀਂ', 'सक्रिय बुकिंग नाही'),
  noActiveBookingSub: r('मंडी में बिना इंतजार एंट्री के लिए अभी गेट स्लॉट बुक करें', 'Book a gate slot now for zero-wait mandi entry', 'ਮੰਡੀ ਵਿੱਚ ਬਿਨਾਂ ਉਡੀਕ ਐਂਟਰੀ ਲਈ ਹੁਣੇ ਸਲਾਟ ਬੁੱਕ ਕਰੋ', 'मंडीत विना प्रतीक्षा प्रवेशासाठी आता स्लॉट बुक करा'),
  bookASlot: r('स्लॉट बुक करें →', 'Book a slot →', 'ਸਲਾਟ ਬੁੱਕ ਕਰੋ →', 'स्लॉट बुक करा →'),
  bookSlot: r('स्लॉट बुक करें', 'Book Slot', 'ਸਲਾਟ ਬੁੱਕ', 'स्लॉट बुक'),
  myToken: r('मेरा टोकन', 'My Token', 'ਮੇਰਾ ਟੋਕਨ', 'माझे टोकन'),
  payments: r('भुगतान व रसीद', 'Payments & Receipts', 'ਭੁਗਤਾਨ ਅਤੇ ਰਸੀਦ', 'पेमेंट व पावती'),
  history: r('इतिहास', 'History', 'ਇਤਿਹਾਸ', 'इतिहास'),
  myCrops: r('मेरी फसलें', 'My Crops', 'ਮੇਰੀਆਂ ਫਸਲਾਂ', 'माझी पिके'),
  help: r('सहायता', 'Help', 'ਮਦਦ', 'मदत'),
  /* Chat assistant (Gemini chatbot) tiles & screen */
  chat_withAssistant: r('सहायक से बात करें', 'Chat with Assistant', 'ਸਹਾਇਕ ਨਾਲ ਗੱਲ ਕਰੋ', 'सहायकाशी चॅट करा'),
  chat_title: r('AgroBridge सहायक', 'AgroBridge Assistant', 'AgroBridge ਸਹਾਇਕ', 'AgroBridge सहायक'),
  chat_greeting: r(
    'नमस्ते 🙏 मैं AgroBridge सहायक हूँ। स्लॉट बुकिंग, टोकन, गेट एंट्री, कतार, गुणवत्ता जांच, तौल और भुगतान – जो भी पूछना चाहें, हिंदी या अंग्रेज़ी में पूछिए।',
    'Namaste 🙏 I am the AgroBridge Assistant. Ask me anything about slot booking, tokens, gate entry, queues, quality check, weighing or payments – in Hindi or English.',
    'ਸਤ ਸ੍ਰੀ ਅਕਾਲ 🙏 ਮੈਂ AgroBridge ਸਹਾਇਕ ਹਾਂ। ਸਲਾਟ ਬੁੱਕਿੰਗ, ਟੋਕਨ, ਗੇਟ ਐਂਟਰੀ, ਕਤਾਰ, ਗੁਣਵੱਤਾ ਜਾਂਚ, ਤੋਲ ਅਤੇ ਭੁਗਤਾਨ – ਜੋ ਵੀ ਪੁੱਛਣਾ ਹੋਵੇ, ਪੰਜਾਬੀ ਜਾਂ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਪੁੱਛੋ।',
    'नमस्कार 🙏 मी AgroBridge सहायक आहे. स्लॉट बुकिंग, टोकन, गेट प्रवेश, रांग, गुणवत्ता तपासणी, वजन आणि पेमेंट – जे काही विचारायचे असेल, मराठी किंवा इंग्रजीत विचारा.'
  ),
  chat_placeholder: r('यहाँ लिखें…', 'Type your message…', 'ਇੱਥੇ ਲਿਖੋ…', 'इथे लिहा…'),
  chat_send: r('भेजें', 'Send', 'ਭੇਜੋ', 'पाठवा'),
  chat_error: r('सहायक से संपर्क नहीं हो सका। कृपया दोबारा कोशिश करें।', 'Could not reach the Assistant. Please try again.', 'ਸਹਾਇਕ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', 'सहायकाशी संपर्क करता आला नाही. कृपया पुन्हा प्रयत्न करा.'),
  chat_faqTitle: r('अक्सर पूछे जाने वाले प्रश्न', 'Frequently Asked Questions', 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਣ ਵਾਲੇ ਸਵਾਲ', 'नेहमी विचारले जाणारे प्रश्न'),
  chat_faqHint: r('पूछने के लिए किसी प्रश्न पर टैप करें', 'Tap a question to ask', 'ਪੁੱਛਣ ਲਈ ਕਿਸੇ ਸਵਾਲ ਤੇ ਟੈਪ ਕਰੋ', 'विचारण्यासाठी प्रश्नावर टॅप करा'),
  chat_faq1: r('मेरा टोकन क्या है?', 'What is my token?', 'ਮੇਰਾ ਟੋਕਨ ਕੀ ਹੈ?', 'माझे टोकन काय आहे?'),
  chat_faq2: r('कतार में मेरी स्थिति क्या है?', 'What is my queue position?', 'ਕਤਾਰ ਵਿੱਚ ਮੇਰੀ ਸਥਿਤੀ ਕੀ ਹੈ?', 'रांगेत माझी स्थिती काय आहे?'),
  chat_faq3: r('मुझसे पहले कितने किसान हैं?', 'How many farmers are ahead of me?', 'ਮੇਰੇ ਤੋਂ ਪਹਿਲਾਂ ਕਿੰਨੇ ਕਿਸਾਨ ਹਨ?', 'माझ्या आधी किती शेतकरी आहेत?'),
  chat_faq4: r('मेरे भुगतान की स्थिति क्या है?', 'What is my payment status?', 'ਮੇਰੇ ਭੁਗਤਾਨ ਦੀ ਸਥਿਤੀ ਕੀ ਹੈ?', 'माझ्या पेमेंटची स्थिती काय आहे?'),
  chat_faq5: r('स्लॉट कैसे बुक करूँ?', 'How do I book a slot?', 'ਸਲਾਟ ਕਿਵੇਂ ਬੁੱਕ ਕਰਾਂ?', 'स्लॉट कसा बुक करू?'),
  chat_faq6: r('मंडी कब खुलती है?', 'When does the mandi open?', 'ਮੰਡੀ ਕਦੋਂ ਖੁੱਲ੍ਹਦੀ ਹੈ?', 'मंडी कधी उघडते?'),
  activeBooking: r('सक्रिय बुकिंग', 'Active Booking', 'ਸਰਗਰਮ ਬੁਕਿੰਗ', 'सक्रिय बुकिंग'),
  trackStatus: r('पूरा विवरण देखें', 'View full details', 'ਪੂਰਾ ਵੇਰਵਾ ਵੇਖੋ', 'संपूर्ण तपशील पहा'),
  fd_myTokensN: r('मेरे टोकन ({n})', 'My Tokens ({n})', 'ਮੇਰੇ ਟੋਕਨ ({n})', 'माझे टोकन ({n})'),
  fd_otherTokens: r('आपके अन्य टोकन ({n})', 'Your other tokens ({n})', 'ਤੁਹਾਡੇ ਹੋਰ ਟੋਕਨ ({n})', 'तुमचे इतर टोकन ({n})'),
  fd_cropLine: r('फसल: {crop} • {qty} क्विंटल', 'Crop: {crop} • {qty} qtl', 'ਫਸਲ: {crop} • {qty} ਕੁਇੰਟਲ', 'पीक: {crop} • {qty} क्विंटल'),

  /* ------------------------------------------------------------ */
  /* Queue status card (traffic light)                             */
  /* ------------------------------------------------------------ */
  q_nowServing: r('अभी चल रहा है', 'Now serving', 'ਹੁਣ ਚੱਲ ਰਿਹਾ', 'सध्या सुरू'),
  q_yourToken: r('आपका टोकन', 'Your token', 'ਤੁਹਾਡਾ ਟੋਕਨ', 'तुमचे टोकन'),
  q_ahead: r('आपसे पहले', 'Ahead of you', 'ਤੁਹਾਡੇ ਤੋਂ ਪਹਿਲਾਂ', 'तुमच्या आधी'),
  q_etaWait: r('अनुमानित प्रतीक्षा: {eta}', 'Estimated wait: {eta}', 'ਅਨੁਮਾਨਿਤ ਉਡੀਕ: {eta}', 'अंदाजे प्रतीक्षा: {eta}'),
  q_etaNote: r('(अनुमान मात्र)', '(estimate only)', '(ਸਿਰਫ਼ ਅਨੁਮਾਨ)', '(फक्त अंदाज)'),
  q_aboutMin: r('लगभग {m} मिनट', 'about {m} min', 'ਲਗਭਗ {m} ਮਿੰਟ', 'सुमारे {m} मिनिटे'),
  q_aboutHr: r('लगभग {h} घंटे', 'about {h} hr', 'ਲਗਭਗ {h} ਘੰਟੇ', 'सुमारे {h} तास'),
  q_aboutHrMin: r('लगभग {h} घंटे {m} मिनट', 'about {h} hr {m} min', 'ਲਗਭਗ {h} ਘੰਟੇ {m} ਮਿੰਟ', 'सुमारे {h} तास {m} मिनिटे'),
  q_comeToGate: r('कृपया अपना वाहन लेकर गेट पर आएं', 'Please bring your vehicle to the gate', 'ਕਿਰਪਾ ਕਰਕੇ ਵਾਹਨ ਲੈ ਕੇ ਗੇਟ ਤੇ ਆਓ', 'कृपया वाहन घेऊन गेटवर या'),
  // headlines/details produced by buildQueueView
  qv_action_h: r('जांच पूरी — भाव तय करें', 'Assay done — fix your price', 'ਜਾਂਚ ਪੂਰੀ — ਭਾਅ ਤੈਅ ਕਰੋ', 'तपासणी पूर्ण — भाव ठरवा'),
  qv_action_d: r('ग्रेड {grade} • MSP पर बेचें या नीलामी शुरू करें। टैप करें →', 'Grade {grade} • Sell at MSP or start an auction. Tap →', 'ਗ੍ਰੇਡ {grade} • MSP ਤੇ ਵੇਚੋ ਜਾਂ ਨੀਲਾਮੀ ਸ਼ੁਰੂ ਕਰੋ। ਟੈਪ ਕਰੋ →', 'ग्रेड {grade} • MSP ला विका किंवा लिलाव सुरू करा. टॅप करा →'),
  qv_inside_h: r('आप मंडी के अंदर हैं', 'You are inside the mandi', 'ਤੁਸੀਂ ਮੰਡੀ ਦੇ ਅੰਦਰ ਹੋ', 'तुम्ही मंडीच्या आत आहात'),
  qv_inside_lane_d: r('अपना वाहन लेन {lane} में ले जाएं। वहीं गुणवत्ता जांच होगी।', 'Take your vehicle to Lane {lane}. Quality check happens there.', 'ਆਪਣਾ ਵਾਹਨ ਲੇਨ {lane} ਵਿੱਚ ਲੈ ਜਾਓ। ਉੱਥੇ ਹੀ ਗੁਣਵੱਤਾ ਜਾਂਚ ਹੋਵੇਗੀ।', 'तुमचे वाहन लेन {lane} मध्ये न्या. तिथेच गुणवत्ता तपासणी होईल.'),
  qv_inside_d: r('गुणवत्ता जांच की प्रतीक्षा करें', 'Waiting for quality check', 'ਗੁਣਵੱਤਾ ਜਾਂਚ ਦੀ ਉਡੀਕ ਕਰੋ', 'गुणवत्ता तपासणीची प्रतीक्षा'),
  qv_priceFixed_h: r('भाव तय: ₹{rate} / क्विंटल', 'Price fixed: ₹{rate} / qtl', 'ਭਾਅ ਤੈਅ: ₹{rate} / ਕੁਇੰਟਲ', 'भाव निश्चित: ₹{rate} / क्विंटल'),
  qv_priceFixed_d: r('खरीदार: {buyer} • अब तौल के लिए जाएँ', 'Buyer: {buyer} • proceed to weighbridge', 'ਖਰੀਦਦਾਰ: {buyer} • ਹੁਣ ਤੋਲ ਲਈ ਜਾਓ', 'खरेदीदार: {buyer} • आता वजनासाठी जा'),
  qv_weighed_h: r('तौल पूरा — भुगतान की प्रतीक्षा', 'Weighed — awaiting payment', 'ਤੋਲ ਪੂਰਾ — ਭੁਗਤਾਨ ਦੀ ਉਡੀਕ', 'वजन पूर्ण — पेमेंटची प्रतीक्षा'),
  qv_weighed_d: r('{qty} क्विंटल × ₹{rate}', '{qty} qtl × ₹{rate}', '{qty} ਕੁਇੰਟਲ × ₹{rate}', '{qty} क्विंटल × ₹{rate}'),
  qv_payPending_h: r('भुगतान तैयार हो रहा है', 'Payment being prepared', 'ਭੁਗਤਾਨ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹੈ', 'पेमेंट तयार होत आहे'),
  qv_payPending_d: r('कैशियर रसीद बना रहा है', 'Cashier is preparing the receipt', 'ਕੈਸ਼ੀਅਰ ਰਸੀਦ ਬਣਾ ਰਿਹਾ ਹੈ', 'कॅशियर पावती तयार करत आहे'),
  qv_paid_h: r('भुगतान पूरा हुआ', 'Payment complete', 'ਭੁਗਤਾਨ ਪੂਰਾ ਹੋਇਆ', 'पेमेंट पूर्ण'),
  qv_noShow_h: r('आप उपस्थित नहीं हुए', 'You did not show up', 'ਤੁਸੀਂ ਹਾਜ਼ਰ ਨਹੀਂ ਹੋਏ', 'तुम्ही हजर झाला नाहीत'),
  qv_closed_h: r('यह टोकन बंद है', 'This token is closed', 'ਇਹ ਟੋਕਨ ਬੰਦ ਹੈ', 'हे टोकन बंद आहे'),
  qv_notStarted_h: r('कतार अभी शुरू नहीं हुई', 'Queue has not started yet', 'ਕਤਾਰ ਅਜੇ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋਈ', 'रांग अजून सुरू झाली नाही'),
  qv_notStarted_d: r('आपका टोकन {token}', 'Your token {token}', 'ਤੁਹਾਡਾ ਟੋਕਨ {token}', 'तुमचे टोकन {token}'),
  qv_go_h: r('गेट पर पहुंचें - आपकी बारी है', 'Go to the gate — it is your turn', 'ਗੇਟ ਤੇ ਪਹੁੰਚੋ - ਤੁਹਾਡੀ ਵਾਰੀ ਹੈ', 'गेटवर जा - तुमची पाळी आहे'),
  qv_go_d: r('अभी टोकन {token} चल रहा है • अंदर {n} वाहन', 'Now serving {token} • {n} inside', 'ਹੁਣ ਟੋਕਨ {token} ਚੱਲ ਰਿਹਾ • ਅੰਦਰ {n} ਵਾਹਨ', 'सध्या टोकन {token} सुरू • आत {n} वाहने'),
  qv_go_empty: r('गेट खाली है', 'The gate is free', 'ਗੇਟ ਖਾਲੀ ਹੈ', 'गेट रिकामे आहे'),
  qv_ready_h: r('तैयार हो जाइए', 'Get ready', 'ਤਿਆਰ ਹੋ ਜਾਓ', 'तयार व्हा'),
  qv_wait_h: r('अभी समय है', 'Still some time', 'ਅਜੇ ਸਮਾਂ ਹੈ', 'अजून वेळ आहे'),
  qv_aheadLine: r('आपसे पहले {n} किसान • अंदर {inside} वाहन', '{n} farmers ahead • {inside} inside', 'ਤੁਹਾਡੇ ਤੋਂ ਪਹਿਲਾਂ {n} ਕਿਸਾਨ • ਅੰਦਰ {inside} ਵਾਹਨ', 'तुमच्या आधी {n} शेतकरी • आत {inside} वाहने'),

  /* ------------------------------------------------------------ */
  /* Crop / centre / slot selection                                */
  /* ------------------------------------------------------------ */
  selectCrop: r('चरण 1: फसल चुनें', 'Step 1: Select Crop', 'ਪੜਾਅ 1: ਫਸਲ ਚੁਣੋ', 'पायरी 1: पीक निवडा'),
  selectCropSub: r('आज मंडी में बेचने वाली फसल चुनें', 'Choose the crop you will sell today', 'ਅੱਜ ਮੰਡੀ ਵਿੱਚ ਵੇਚਣ ਵਾਲੀ ਫਸਲ ਚੁਣੋ', 'आज मंडीत विकायचे पीक निवडा'),
  selectCentre: r('चरण 2: मंडी चुनें', 'Step 2: Select Mandi', 'ਪੜਾਅ 2: ਮੰਡੀ ਚੁਣੋ', 'पायरी 2: मंडी निवडा'),
  selectCentreSub: r('अपनी फसल लेने वाला निकटतम केंद्र चुनें', 'Pick the nearest centre accepting your crop', 'ਆਪਣੀ ਫਸਲ ਲੈਣ ਵਾਲੀ ਨਜ਼ਦੀਕੀ ਮੰਡੀ ਚੁਣੋ', 'तुमचे पीक स्वीकारणारी जवळची मंडी निवडा'),
  selectSlot: r('चरण 3: आगमन समय', 'Step 3: Arrival Time', 'ਪੜਾਅ 3: ਆਮਦ ਸਮਾਂ', 'पायरी 3: आगमन वेळ'),
  cs_locating: r('आपकी लोकेशन से मंडियों की दूरी पता की जा रही है...', 'Finding mandi distances from your location...', 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਤੋਂ ਮੰਡੀਆਂ ਦੀ ਦੂਰੀ ਪਤਾ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ...', 'तुमच्या स्थानापासून मंडींचे अंतर शोधत आहे...'),
  cs_nearestByLocation: r('📍 आपके स्थान के अनुसार निकटतम मंडियां', '📍 Nearest mandis by your location', '📍 ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਅਨੁਸਾਰ ਨਜ਼ਦੀਕੀ ਮੰਡੀਆਂ', '📍 तुमच्या स्थानानुसार जवळच्या मंडी'),
  cs_noPermission: r('लोकेशन अनुमति नहीं मिली।', 'Location permission denied.', 'ਲੋਕੇਸ਼ਨ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਮਿਲੀ।', 'स्थान परवानगी मिळाली नाही.'),
  cs_noLocation: r('आपकी वर्तमान लोकेशन नहीं मिल सकी।', 'Could not get your current location.', 'ਤੁਹਾਡੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਮਿਲੀ।', 'तुमचे सध्याचे स्थान मिळाले नाही.'),
  cs_locError: r('लोकेशन प्राप्त नहीं हो सकी।', 'Location unavailable.', 'ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਮਿਲੀ।', 'स्थान मिळाले नाही.'),
  cs_loadFail: r('मंडी लोड नहीं हुई', 'Could not load mandis', 'ਮੰਡੀ ਲੋਡ ਨਹੀਂ ਹੋਈ', 'मंडी लोड झाली नाही'),
  cs_loadFailSub: r('मंडियों की जानकारी प्राप्त नहीं हो सकी।', 'Mandi information could not be fetched.', 'ਮੰਡੀਆਂ ਦੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਮਿਲੀ।', 'मंडींची माहिती मिळाली नाही.'),
  cs_noneForCrop: r('इस फसल के लिए कोई मंडी उपलब्ध नहीं है।', 'No mandi available for this crop.', 'ਇਸ ਫਸਲ ਲਈ ਕੋਈ ਮੰਡੀ ਉਪਲਬਧ ਨਹੀਂ।', 'या पिकासाठी मंडी उपलब्ध नाही.'),
  cs_noneForCropSub: r('कृपया बाद में पुनः प्रयास करें या दूसरी फसल चुनें।', 'Please try later or choose another crop.', 'ਬਾਅਦ ਵਿੱਚ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਹੋਰ ਫਸਲ ਚੁਣੋ।', 'नंतर प्रयत्न करा किंवा दुसरे पीक निवडा.'),
  cs_nearest: r('सबसे नजदीकी', 'Nearest', 'ਸਭ ਤੋਂ ਨੇੜੇ', 'सर्वात जवळ'),
  cs_lanes: r('🛣️ {n} लेन', '🛣️ {n} lanes', '🛣️ {n} ਲੇਨ', '🛣️ {n} लेन'),
  cs_minPerVehicle: r('⏱️ {n} मिनट/वाहन', '⏱️ {n} min/vehicle', '⏱️ {n} ਮਿੰਟ/ਵਾਹਨ', '⏱️ {n} मिनिटे/वाहन'),
  cs_hours: r('समय: {a} - {b}', 'Hours: {a} - {b}', 'ਸਮਾਂ: {a} - {b}', 'वेळ: {a} - {b}'),

  ss_testBanner: r('🧪 टेस्टिंग मोड: आज के सभी स्लॉट पूरे दिन खुले हैं', '🧪 Testing mode: all of today\'s slots are open all day', '🧪 ਟੈਸਟਿੰਗ ਮੋਡ: ਅੱਜ ਦੇ ਸਾਰੇ ਸਲਾਟ ਪੂਰਾ ਦਿਨ ਖੁੱਲ੍ਹੇ ਹਨ', '🧪 चाचणी मोड: आजचे सर्व स्लॉट दिवसभर खुले'),
  ss_pickDate: r('तारीख चुनें', 'Choose date', 'ਤਾਰੀਖ ਚੁਣੋ', 'तारीख निवडा'),
  ss_selected: r('(चुनी हुई: {label} {date})', '(selected: {label} {date})', '(ਚੁਣੀ: {label} {date})', '(निवडलेली: {label} {date})'),
  ss_pickSlot: r('स्लॉट चुनें', 'Choose slot', 'ਸਲਾਟ ਚੁਣੋ', 'स्लॉट निवडा'),
  ss_noneToday: r('आज के बचे हुए स्लॉट खत्म हो गए। कल के लिए बुक करें।', 'No slots left today. Book for tomorrow.', 'ਅੱਜ ਦੇ ਸਲਾਟ ਖ਼ਤਮ। ਕੱਲ੍ਹ ਲਈ ਬੁੱਕ ਕਰੋ।', 'आजचे स्लॉट संपले. उद्यासाठी बुक करा.'),
  ss_noneDay: r('इस दिन कोई स्लॉट उपलब्ध नहीं है।', 'No slots available on this day.', 'ਇਸ ਦਿਨ ਕੋਈ ਸਲਾਟ ਉਪਲਬਧ ਨਹੀਂ।', 'या दिवशी स्लॉट उपलब्ध नाही.'),
  ss_full: r('क्षमता पूरी', 'Full', 'ਸਮਰੱਥਾ ਪੂਰੀ', 'क्षमता पूर्ण'),
  ss_available: r('{a} / {b} स्थान उपलब्ध', '{a} / {b} places available', '{a} / {b} ਥਾਂ ਉਪਲਬਧ', '{a} / {b} जागा उपलब्ध'),
  ss_qtyTitle: r('अनुमानित मात्रा', 'Approximate quantity', 'ਅਨੁਮਾਨਿਤ ਮਾਤਰਾ', 'अंदाजे प्रमाण'),
  ss_qtyLabel: r('फसल की मात्रा', 'Crop quantity', 'ਫਸਲ ਦੀ ਮਾਤਰਾ', 'पिकाचे प्रमाण'),
  ss_loadFail: r('स्लॉट लोड नहीं हुए', 'Could not load slots', 'ਸਲਾਟ ਲੋਡ ਨਹੀਂ ਹੋਏ', 'स्लॉट लोड झाले नाहीत'),
  ss_pickOne: r('कृपया एक स्लॉट चुनें।', 'Please choose a slot.', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਸਲਾਟ ਚੁਣੋ।', 'कृपया एक स्लॉट निवडा.'),
  ss_isFull: r('स्लॉट पूरा है', 'Slot is full', 'ਸਲਾਟ ਭਰ ਗਿਆ', 'स्लॉट भरला आहे'),
  ss_isFullSub: r('यह स्लॉट उपलब्ध नहीं है। कृपया दूसरा स्लॉट चुनें।', 'This slot is unavailable. Please choose another.', 'ਇਹ ਸਲਾਟ ਉਪਲਬਧ ਨਹੀਂ। ਹੋਰ ਚੁਣੋ।', 'हा स्लॉट उपलब्ध नाही. दुसरा निवडा.'),
  ss_enterQty: r('कृपया अनुमानित मात्रा दर्ज करें।', 'Please enter an approximate quantity.', 'ਅਨੁਮਾਨਿਤ ਮਾਤਰਾ ਦਰਜ ਕਰੋ।', 'अंदाजे प्रमाण टाका.'),
  ss_bookFail: r('बुकिंग असफल', 'Booking failed', 'ਬੁਕਿੰਗ ਅਸਫਲ', 'बुकिंग अयशस्वी'),
  ss_bookFailSub: r('बुकिंग करते समय समस्या हुई।', 'There was a problem while booking.', 'ਬੁਕਿੰਗ ਵਿੱਚ ਸਮੱਸਿਆ ਆਈ।', 'बुकिंग करताना समस्या आली.'),
  ss_next: r('आगे बढ़ें', 'Next', 'ਅੱਗੇ ਵਧੋ', 'पुढे जा'),
  // install41: quintal-based capacity - what the farmer sees per hour
  ss_room: r('आपके {q} क्विंटल के लिए जगह है', 'Room for your {q} quintals', 'ਤੁਹਾਡੇ {q} ਕੁਇੰਟਲ ਲਈ ਥਾਂ ਹੈ', 'तुमच्या {q} क्विंटलसाठी जागा आहे'),
  ss_roomRun: r('{q} क्विंटल के लिए जगह है ({h} घंटे, एक ही टोकन)', 'Room for {q} quintals ({h} hours, one token)', '{q} ਕੁਇੰਟਲ ਲਈ ਥਾਂ ਹੈ ({h} ਘੰਟੇ, ਇੱਕੋ ਟੋਕਨ)', '{q} क्विंटलसाठी जागा ({h} तास, एकच टोकन)'),
  ss_noRoom: r('{q} क्विंटल के लिए जगह नहीं', 'No room for {q} quintals', '{q} ਕੁਇੰਟਲ ਲਈ ਥਾਂ ਨਹੀਂ', '{q} क्विंटलसाठी जागा नाही'),
  ss_noVehicle: r('इस घंटे गेट पर वाहन की जगह नहीं', 'No vehicle place at the gate this hour', 'ਇਸ ਘੰਟੇ ਗੇਟ ਤੇ ਵਾਹਨ ਦੀ ਥਾਂ ਨਹੀਂ', 'या तासाला गेटवर वाहनासाठी जागा नाही'),
  ss_closed: r('मंडी ने यह घंटा बंद किया है', 'Mandi has closed this hour', 'ਮੰਡੀ ਨੇ ਇਹ ਘੰਟਾ ਬੰਦ ਕੀਤਾ ਹੈ', 'मंडीने हा तास बंद केला आहे'),
  ss_horizon: r('यह फसल केवल {d} दिन पहले तक बुक हो सकती है', 'This crop can be booked only up to {d} day(s) ahead', 'ਇਹ ਫਸਲ ਸਿਰਫ਼ {d} ਦਿਨ ਪਹਿਲਾਂ ਤੱਕ ਬੁੱਕ ਹੋ ਸਕਦੀ ਹੈ', 'हे पीक फक्त {d} दिवस आधीपर्यंत बुक होऊ शकते'),
  ss_tooLate: r('दिन खत्म होने से पहले पूरा नहीं हो पाएगा', 'Cannot finish before the mandi closes', 'ਮੰਡੀ ਬੰਦ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਪੂਰਾ ਨਹੀਂ ਹੋਵੇਗਾ', 'मंडी बंद होण्याआधी पूर्ण होणार नाही'),
  ss_noRoomDay: r('इस दिन {q} क्विंटल के लिए कोई घंटा खाली नहीं। दूसरी तारीख चुनें।', 'No hour on this day has room for {q} quintals. Try another date.', 'ਇਸ ਦਿਨ {q} ਕੁਇੰਟਲ ਲਈ ਕੋਈ ਘੰਟਾ ਖਾਲੀ ਨਹੀਂ। ਹੋਰ ਤਾਰੀਖ ਚੁਣੋ।', 'या दिवशी {q} क्विंटलसाठी कोणताही तास रिकामा नाही. दुसरी तारीख निवडा.'),
  ss_tooBig: r('{q} क्विंटल एक दिन में इस मंडी में नहीं हो सकता। मात्रा घटाएं या बड़ी मंडी चुनें।', '{q} quintals is more than this mandi can take in one day. Reduce the quantity or pick a bigger mandi.', '{q} ਕੁਇੰਟਲ ਇੱਕ ਦਿਨ ਵਿੱਚ ਇਸ ਮੰਡੀ ਵਿੱਚ ਨਹੀਂ ਹੋ ਸਕਦਾ। ਮਾਤਰਾ ਘਟਾਓ ਜਾਂ ਵੱਡੀ ਮੰਡੀ ਚੁਣੋ।', '{q} क्विंटल या मंडीत एका दिवसात होऊ शकत नाही. प्रमाण कमी करा किंवा मोठी मंडी निवडा.'),
  ss_bigLoad: r('बड़ी खेप: {q} क्विंटल को {h} घंटे लगेंगे। आप एक बार आएंगे, एक टोकन मिलेगा।', 'Large load: {q} quintals takes {h} hours. You arrive once and get one token.', 'ਵੱਡੀ ਖੇਪ: {q} ਕੁਇੰਟਲ ਨੂੰ {h} ਘੰਟੇ ਲੱਗਣਗੇ। ਤੁਸੀਂ ਇੱਕ ਵਾਰ ਆਓਗੇ, ਇੱਕ ਟੋਕਨ ਮਿਲੇਗਾ।', 'मोठा माल: {q} क्विंटलला {h} तास लागतील. तुम्ही एकदाच याल, एक टोकन मिळेल.'),
  ss_arriveHint: r('गेट पर {t} बजे पहुंचें', 'Arrive at the gate at {t}', 'ਗੇਟ ਤੇ {t} ਵਜੇ ਪਹੁੰਚੋ', 'गेटवर {t} वाजता पोहोचा'),
  qty_whyFirst: r('मात्रा पहले इसलिए पूछते हैं ताकि हम बता सकें कि किस घंटे में आपकी फसल के लिए जगह है।', 'We ask the quantity first so we can show which hour has room for your crop.', 'ਮਾਤਰਾ ਪਹਿਲਾਂ ਇਸ ਲਈ ਪੁੱਛਦੇ ਹਾਂ ਤਾਂ ਜੋ ਦੱਸ ਸਕੀਏ ਕਿ ਕਿਸ ਘੰਟੇ ਵਿੱਚ ਤੁਹਾਡੀ ਫਸਲ ਲਈ ਥਾਂ ਹੈ।', 'प्रमाण आधी विचारतो म्हणजे कोणत्या तासाला तुमच्या पिकासाठी जागा आहे ते सांगता येईल.'),
  qv_nextBusy_h: r('आप अगले हैं — गेट अभी व्यस्त है', 'You are next — gate is busy right now', 'ਤੁਸੀਂ ਅਗਲੇ ਹੋ — ਗੇਟ ਹੁਣ ਵਿਅਸਤ ਹੈ', 'तुम्ही पुढचे आहात — गेट सध्या व्यस्त आहे'),
  // install42: pass = hour, not a number. Outside the gate: time light only.
  qv_slotBefore_h: r('आपका समय: {t}', 'Your slot: {t}', 'ਤੁਹਾਡਾ ਸਮਾਂ: {t}', 'तुमची वेळ: {t}'),
  qv_slotBefore_d: r('{t} बजे गेट पर पहुंचें। उससे पहले प्रवेश नहीं मिलेगा।', 'Reach the gate at {t}. Entry is not given before your hour.', '{t} ਵਜੇ ਗੇਟ ਤੇ ਪਹੁੰਚੋ। ਉਸ ਤੋਂ ਪਹਿਲਾਂ ਐਂਟਰੀ ਨਹੀਂ।', '{t} वाजता गेटवर पोहोचा. त्याआधी प्रवेश नाही.'),
  qv_slotBefore_soon_d: r('लगभग {m} मिनट में आपका समय शुरू होगा। निकलने की तैयारी करें।', 'Your hour starts in about {m} min. Get ready to leave.', 'ਲਗਭਗ {m} ਮਿੰਟ ਵਿੱਚ ਤੁਹਾਡਾ ਸਮਾਂ ਸ਼ੁਰੂ ਹੋਵੇਗਾ।', 'सुमारे {m} मिनिटांत तुमची वेळ सुरू होईल.'),
  qv_slotOpen_h: r('आपका समय चल रहा है: {t}', 'Your slot is open: {t}', 'ਤੁਹਾਡਾ ਸਮਾਂ ਚੱਲ ਰਿਹਾ: {t}', 'तुमची वेळ सुरू आहे: {t}'),
  qv_slotOpen_d: r('गेट पर जाएं। इस घंटे में जो पहले आएगा, पहले अंदर जाएगा।', 'Go to the gate. In this hour, first to arrive goes first.', 'ਗੇਟ ਤੇ ਜਾਓ। ਇਸ ਘੰਟੇ ਜੋ ਪਹਿਲਾਂ ਆਵੇਗਾ, ਪਹਿਲਾਂ ਅੰਦਰ।', 'गेटवर जा. या तासात आधी येईल तो आधी आत.'),
  qv_slotPassed_h: r('आपका समय ({t}) निकल गया', 'Your slot ({t}) has passed', 'ਤੁਹਾਡਾ ਸਮਾਂ ({t}) ਲੰਘ ਗਿਆ', 'तुमची वेळ ({t}) निघून गेली'),
  qv_slotPassed_d: r('ऐप में नीचे बताएं — देर हो गई है (फिर से बुक करें) या आज नहीं आएंगे। देर वाले किसान को गेट अधिकारी आज के खाली घंटे में जगह देंगे।', 'Tell us below — running late (re-book me) or not coming today. Late farmers are fitted into a free hour today by the gate officer.', 'ਹੇਠਾਂ ਦੱਸੋ — ਦੇਰ ਹੋ ਗਈ (ਦੁਬਾਰਾ ਬੁੱਕ ਕਰੋ) ਜਾਂ ਅੱਜ ਨਹੀਂ ਆਓਗੇ।', 'खाली सांगा — उशीर झाला (पुन्हा बुक करा) की आज येणार नाही.'),
  qv_missed_h: r('समय निकल गया — गेट पर नई बुकिंग हुई/होगी', 'Slot missed — re-booked at the gate', 'ਸਮਾਂ ਲੰਘ ਗਿਆ — ਗੇਟ ਤੇ ਨਵੀਂ ਬੁਕਿੰਗ', 'वेळ निघून गेली — गेटवर नवीन बुकिंग'),
  q_goRebook: r('गेट पर जाकर नया समय लें', 'Go to the gate for a new slot', 'ਗੇਟ ਤੇ ਜਾ ਕੇ ਨਵਾਂ ਸਮਾਂ ਲਓ', 'गेटवर जाऊन नवीन वेळ घ्या'),
  q_yourLane: r('आपकी लेन', 'Your lane', 'ਤੁਹਾਡੀ ਲੇਨ', 'तुमची लेन'),
  q_aheadInLane: r('लेन में आगे', 'Ahead in lane', 'ਲੇਨ ਵਿੱਚ ਅੱਗੇ', 'लेनमध्ये पुढे'),
  q_wait: r('इंतज़ार', 'Wait', 'ਉਡੀਕ', 'प्रतीक्षा'),
  td_yourPass: r('आपका गेट पास', 'Your gate pass', 'ਤੁਹਾਡਾ ਗੇਟ ਪਾਸ', 'तुमचा गेट पास'),
  'st_missed': r('समय निकला', 'MISSED', 'ਸਮਾਂ ਲੰਘਿਆ', 'वेळ चुकली'),
  // gate officer
  gs_slotPassed: r('समय निकल चुका है', 'Slot has passed', 'ਸਮਾਂ ਲੰਘ ਚੁੱਕਾ ਹੈ', 'वेळ निघून गेली आहे'),
  gs_slotPassedSub: r('यह पास {t} का था। सीधे प्रवेश नहीं — किसान को आज के अगले खाली घंटे में नई बुकिंग दें।', 'This pass was for {t}. No direct entry — give the farmer a new booking in the next hour today with room.', 'ਇਹ ਪਾਸ {t} ਦਾ ਸੀ। ਸਿੱਧੀ ਐਂਟਰੀ ਨਹੀਂ — ਅੱਜ ਦੇ ਅਗਲੇ ਖਾਲੀ ਘੰਟੇ ਵਿੱਚ ਨਵੀਂ ਬੁਕਿੰਗ ਦਿਓ।', 'हा पास {t} चा होता. थेट प्रवेश नाही — आजच्या पुढील रिकाम्या तासात नवीन बुकिंग द्या.'),
  gs_slotNotOpen: r('समय अभी शुरू नहीं हुआ', 'Slot not open yet', 'ਸਮਾਂ ਅਜੇ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋਇਆ', 'वेळ अजून सुरू झाली नाही'),
  gs_slotNotOpenSub: r('यह पास {t} का है। किसान को अपने समय पर आने को कहें।', 'This pass is for {t}. Ask the farmer to come back at his hour.', 'ਇਹ ਪਾਸ {t} ਦਾ ਹੈ। ਕਿਸਾਨ ਨੂੰ ਆਪਣੇ ਸਮੇਂ ਤੇ ਆਉਣ ਲਈ ਕਹੋ।', 'हा पास {t} चा आहे. शेतकऱ्याला त्याच्या वेळेला यायला सांगा.'),
  gs_rebook: r('नई बुकिंग दें', 'Re-book', 'ਨਵੀਂ ਬੁਕਿੰਗ', 'नवीन बुकिंग'),
  gs_walkIn: r('बिना बुकिंग आया किसान — गेट पर बुक करें', 'Farmer without booking — book at gate', 'ਬਿਨਾਂ ਬੁਕਿੰਗ ਆਇਆ ਕਿਸਾਨ — ਗੇਟ ਤੇ ਬੁੱਕ ਕਰੋ', 'बुकिंगशिवाय आलेला शेतकरी — गेटवर बुक करा'),
  sq_hourOpen: r('चालू घंटा — आने के क्रम में प्रवेश', 'Open now — admit in arrival order', 'ਚਾਲੂ ਘੰਟਾ — ਆਉਣ ਦੇ ਕ੍ਰਮ ਵਿੱਚ', 'सुरू तास — येण्याच्या क्रमाने'),
  sq_hourPassed: r('समय निकला — आने पर नई बुकिंग', 'Passed — re-book on arrival', 'ਸਮਾਂ ਲੰਘਿਆ — ਆਉਣ ਤੇ ਨਵੀਂ ਬੁਕਿੰਗ', 'वेळ गेली — आल्यावर नवीन बुकिंग'),
  sq_hourLater: r('बाद में', 'Later', 'ਬਾਅਦ ਵਿੱਚ', 'नंतर'),
  // book at gate
  // install43: multi-vehicle gate entry
  gs_howMany: r('कितने वाहन?', 'How many vehicles?', 'ਕਿੰਨੇ ਵਾਹਨ?', 'किती वाहने?'),
  gs_vehicleN: r('वाहन {n}', 'Vehicle {n}', 'ਵਾਹਨ {n}', 'वाहन {n}'),
  gs_nVehicles: r('{n} वाहन', '{n} vehicle(s)', '{n} ਵਾਹਨ', '{n} वाहने'),
  gs_enterVehicleN: r('वाहन {n} का नंबर दर्ज करें।', 'Enter the plate of vehicle {n}.', 'ਵਾਹਨ {n} ਦਾ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'वाहन {n} चा क्रमांक टाका.'),
  gs_badPlate: r('सही नंबर नहीं। उदाहरण: HR26AB1234', 'Not a valid plate. Example: HR26AB1234', 'ਸਹੀ ਨੰਬਰ ਨਹੀਂ। ਉਦਾਹਰਣ: HR26AB1234', 'योग्य क्रमांक नाही. उदा: HR26AB1234'),
  gs_dupPlate: r('यह नंबर इसी टोकन में दोबारा है।', 'This plate is repeated on this token.', 'ਇਹ ਨੰਬਰ ਇਸੇ ਟੋਕਨ ਵਿੱਚ ਦੁਬਾਰਾ ਹੈ।', 'हा क्रमांक याच टोकनमध्ये पुन्हा आहे.'),
  gs_plateHint: r('राज्य कोड + जिला + श्रृंखला + 4 अंक, जैसे HR 26 AB 1234। एक ही नंबर दो बार नहीं, और जो वाहन पहले से अंदर है वह नहीं।', 'State + district + series + 4 digits, e.g. HR 26 AB 1234. No repeats, and no plate that is already inside the mandi.', 'ਰਾਜ + ਜ਼ਿਲ੍ਹਾ + ਲੜੀ + 4 ਅੰਕ, ਜਿਵੇਂ HR 26 AB 1234।', 'राज्य + जिल्हा + मालिका + 4 अंक, उदा. HR 26 AB 1234.'),
  sq_blockOpen: r('🟢 अभी प्रवेश — इस घंटे के पास (आने के क्रम में)', '🟢 ADMIT NOW — this hour\'s passes (arrival order)', '🟢 ਹੁਣ ਐਂਟਰੀ — ਇਸ ਘੰਟੇ ਦੇ ਪਾਸ', '🟢 आता प्रवेश — या तासाचे पास'),
  sq_blockPassed: r('🔴 समय निकला — आने पर नई बुकिंग दें', '🔴 MISSED — re-book on arrival', '🔴 ਸਮਾਂ ਲੰਘਿਆ — ਨਵੀਂ ਬੁਕਿੰਗ', '🔴 वेळ गेली — नवीन बुकिंग'),
  sq_blockLater: r('⚪ बाद के घंटे — अभी प्रवेश नहीं', '⚪ LATER — not yet', '⚪ ਬਾਅਦ ਦੇ ਘੰਟੇ — ਹਾਲੇ ਨਹੀਂ', '⚪ नंतरचे तास — अजून नाही'),
  sq_blockEmpty: r('कोई नहीं', 'None', 'ਕੋਈ ਨਹੀਂ', 'कोणी नाही'),
  // install43: per-vehicle weighing
  wg_total: r('कुल शुद्ध वजन (सभी वाहन)', 'Total net weight (all vehicles)', 'ਕੁੱਲ ਸ਼ੁੱਧ ਵਜ਼ਨ (ਸਾਰੇ ਵਾਹਨ)', 'एकूण निव्वळ वजन (सर्व वाहने)'),
  wg_perVehicleDeclared: r('घोषित ≈ {q} क्विं./वाहन', 'declared ≈ {q} q/vehicle', 'ਘੋਸ਼ਿਤ ≈ {q} ਕੁਇੰ./ਵਾਹਨ', 'घोषित ≈ {q} क्विं./वाहन'),
  td_declared: r('आपने बताया था', 'You declared', 'ਤੁਸੀਂ ਦੱਸਿਆ ਸੀ', 'तुम्ही सांगितले होते'),
  td_difference: r('अंतर', 'Difference', 'ਫ਼ਰਕ', 'फरक'),
  td_showTrucks: r('हर वाहन का ब्योरा देखें ({n})', 'See each vehicle ({n})', 'ਹਰ ਵਾਹਨ ਦਾ ਵੇਰਵਾ ({n})', 'प्रत्येक वाहनाचा तपशील ({n})'),
  td_hideTrucks: r('ब्योरा छिपाएं', 'Hide details', 'ਵੇਰਵਾ ਲੁਕਾਓ', 'तपशील लपवा'),
  td_declaredShare: r('घोषित हिस्सा ≈ {q}', 'declared share ≈ {q}', 'ਘੋਸ਼ਿਤ ਹਿੱਸਾ ≈ {q}', 'घोषित वाटा ≈ {q}'),
  // install43: grade-wise MSP with reasons
  msp_advertised: r('घोषित MSP: ₹{a} / क्विंटल', 'Advertised MSP: ₹{a} / quintal', 'ਘੋਸ਼ਿਤ MSP: ₹{a} / ਕੁਇੰਟਲ', 'जाहीर MSP: ₹{a} / क्विंटल'),
  msp_deduction: r('कटौती: − ₹{d} / क्विंटल (ग्रेड {g})', 'Deduction: − ₹{d} / quintal (grade {g})', 'ਕਟੌਤੀ: − ₹{d} / ਕੁਇੰਟਲ (ਗ੍ਰੇਡ {g})', 'कपात: − ₹{d} / क्विंटल (ग्रेड {g})'),
  msp_fullFaq: r('FAQ ग्रेड — पूरा घोषित MSP मिलेगा', 'FAQ grade — you get the full advertised MSP', 'FAQ ਗ੍ਰੇਡ — ਪੂਰਾ MSP ਮਿਲੇਗਾ', 'FAQ ग्रेड — पूर्ण MSP मिळेल'),
  msp_reason_faq: r('फसल तय मानक (FAQ) पर खरी है।', 'Crop meets the Fair Average Quality standard.', 'ਫਸਲ ਤੈਅ ਮਿਆਰ (FAQ) ਤੇ ਖਰੀ ਹੈ।', 'पीक निर्धारित मानकावर (FAQ) उतरले.'),
  msp_reason_a: r('क्यों कम: फसल मानक से थोड़ी नीचे है (हल्की नमी या हल्का कचरा)। सरकारी खरीद नियमों के अनुसार मामूली मूल्य-कटौती लागू है।', 'Why less: the crop is slightly below standard (mild moisture or foreign matter). A small value-cut applies under government procurement rules.', 'ਕਿਉਂ ਘੱਟ: ਫਸਲ ਮਿਆਰ ਤੋਂ ਥੋੜ੍ਹੀ ਹੇਠਾਂ ਹੈ। ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਮਾਮੂਲੀ ਕਟੌਤੀ।', 'का कमी: पीक मानकापेक्षा थोडे खाली आहे. नियमांनुसार थोडी कपात.'),
  msp_reason_b: r('क्यों कम: नमी सीमा से ज़्यादा है या दाना सिकुड़ा/टूटा है। सरकारी खरीद नियम (uniform specifications) के अनुसार मूल्य-कटौती लागू है। सुखाकर/साफ करके लाने पर पूरा MSP मिलता है।', 'Why less: moisture is above the limit or grain is shrivelled/broken. A value-cut applies under government uniform specifications. Dried and cleaned produce gets the full MSP.', 'ਕਿਉਂ ਘੱਟ: ਨਮੀ ਹੱਦ ਤੋਂ ਵੱਧ ਜਾਂ ਦਾਣਾ ਸੁੰਗੜਿਆ/ਟੁੱਟਿਆ। ਨਿਯਮਾਂ ਅਨੁਸਾਰ ਕਟੌਤੀ। ਸੁਕਾ ਕੇ ਲਿਆਉਣ ਤੇ ਪੂਰਾ MSP।', 'का कमी: ओलावा मर्यादेपेक्षा जास्त किंवा दाणा आकसलेला/तुटलेला. नियमांनुसार कपात. वाळवून आणल्यास पूर्ण MSP.'),
  msp_reason_rejected: r('फसल खरीद मानक पर खरी नहीं उतरी।', 'Crop did not meet procurement standards.', 'ਫਸਲ ਖਰੀਦ ਮਿਆਰ ਤੇ ਖਰੀ ਨਹੀਂ ਉਤਰੀ।', 'पीक खरेदी मानकावर उतरले नाही.'),
  msp_factor_moisture: r('नमी {v}% — सीमा {limit}%', 'Moisture {v}% — limit {limit}%', 'ਨਮੀ {v}% — ਹੱਦ {limit}%', 'ओलावा {v}% — मर्यादा {limit}%'),
  msp_factor_fm: r('कचरा/विजातीय पदार्थ {v}% — सीमा {limit}%', 'Foreign matter {v}% — limit {limit}%', 'ਕਚਰਾ {v}% — ਹੱਦ {limit}%', 'परकीय पदार्थ {v}% — मर्यादा {limit}%'),
  // install44: capacity engine (admin)
  en_title: r('क्षमता इंजन', 'Capacity engine', 'ਸਮਰੱਥਾ ਇੰਜਣ', 'क्षमता इंजिन'),
  en_capTitle: r('आज की क्षमता', "Today's capacity", 'ਅੱਜ ਦੀ ਸਮਰੱਥਾ', 'आजची क्षमता'),
  en_capSub: r('तय मूल्य (+/−) बनाम इंजन का सीखा हुआ मूल्य। "सीखा हुआ इस्तेमाल करें" चालू करने पर हर घंटे की असली गति से बुकिंग खुलेगी।', 'Set value (+/−) versus what the engine LEARNED from your own weighbridge. Turn on "use learned" to book against the real speed of each hour.', 'ਤੈਅ ਮੁੱਲ (+/−) ਬਨਾਮ ਇੰਜਣ ਦਾ ਸਿੱਖਿਆ ਮੁੱਲ।', 'सेट मूल्य (+/−) विरुद्ध इंजिनने शिकलेले मूल्य.'),
  en_setQh: r('तय क्विंटल/घंटा', 'set quintals / hour', 'ਤੈਅ ਕੁਇੰਟਲ/ਘੰਟਾ', 'सेट क्विंटल/तास'),
  en_qh: r('क्विं/घं', 'q/h', 'ਕੁਇੰ/ਘੰ', 'क्विं/तास'),
  en_learned: r('सीखा हुआ (मॉडल B · EWMA)', 'Learned (Model B · EWMA)', 'ਸਿੱਖਿਆ (ਮਾਡਲ B)', 'शिकलेले (मॉडेल B)'),
  en_learnedSub: r('{d} दिन, {n} तौल से', 'from {d} days, {n} weighings', '{d} ਦਿਨ, {n} ਤੋਲ ਤੋਂ', '{d} दिवस, {n} तोलण्यांतून'),
  en_useLearned: r('सीखा हुआ इस्तेमाल करें', 'use learned', 'ਸਿੱਖਿਆ ਵਰਤੋ', 'शिकलेले वापरा'),
  en_noLearned: r('अभी पर्याप्त तौल नहीं — 2 दिन के बाद सीखा हुआ मूल्य दिखेगा।', 'Not enough weighings yet — a learned value appears after 2 days of data.', 'ਹਾਲੇ ਕਾਫ਼ੀ ਤੋਲ ਨਹੀਂ।', 'अजून पुरेशा तोलण्या नाहीत.'),
  en_perTitle: r('जल्दी खराब होने वाली फसलों का आरक्षण', 'Perishable reserve', 'ਜਲਦੀ ਖ਼ਰਾਬ ਹੋਣ ਵਾਲੀਆਂ ਫਸਲਾਂ ਦਾ ਰਾਖਵਾਂਕਰਨ', 'नाशवंत पिकांसाठी राखीव'),
  en_perSub: r('हर घंटे का इतना हिस्सा टमाटर/प्याज़ जैसी फसलों के लिए रखा जाता है। अनाज इसे एक दिन पहले तक नहीं ले सकता; उसके बाद सबके लिए खुल जाता है। यह लाइन तोड़ना नहीं है — बस की आरक्षित सीट जैसा है।', 'This share of every hour is held for tomato/onion-type crops. Grain cannot take it until the day before; then it opens to everyone. Not a queue-jump — like a reserved seat on a bus.', 'ਹਰ ਘੰਟੇ ਦਾ ਇੰਨਾ ਹਿੱਸਾ ਟਮਾਟਰ/ਪਿਆਜ਼ ਲਈ। ਲਾਈਨ ਤੋੜਨਾ ਨਹੀਂ।', 'प्रत्येक तासाचा इतका भाग टोमॅटो/कांद्यासाठी. रांग मोडणे नाही.'),
  en_perOfHour: r('हर घंटे का हिस्सा', 'of every hour', 'ਹਰ ਘੰਟੇ ਦਾ ਹਿੱਸਾ', 'प्रत्येक तासाचा भाग'),
  en_perRule: r('नियम: अनाज 7 दिन पहले तक, जल्दी खराब होने वाली फसल केवल आज/कल के लिए बुक होती है और छोटे भार की तरह बफर में जा सकती है। पक्की बुकिंग कभी नहीं हटती।', 'Rules: grain books up to 7 days ahead; perishables only today/tomorrow and may use the buffer like a small load. Confirmed bookings are never moved.', 'ਨਿਯਮ: ਅਨਾਜ 7 ਦਿਨ ਪਹਿਲਾਂ ਤੱਕ; ਨਾਸ਼ਵਾਨ ਸਿਰਫ਼ ਅੱਜ/ਕੱਲ੍ਹ।', 'नियम: धान्य 7 दिवस आधी; नाशवंत फक्त आज/उद्या.'),
  en_modelsTitle: r('मॉडल स्विच', 'Model switches', 'ਮਾਡਲ ਸਵਿੱਚ', 'मॉडेल स्विच'),
  en_modelA: r('मॉडल A · घोषित मात्रा सुधार', 'Model A · declared-quantity correction', 'ਮਾਡਲ A · ਘੋਸ਼ਿਤ ਮਾਤਰਾ ਸੁਧਾਰ', 'मॉडेल A · घोषित प्रमाण दुरुस्ती'),
  en_modelASub: r('किसान की पुरानी आदत से (कहा 80, लाया 92) असली मात्रा का अनुमान लगाकर जगह आरक्षित करता है। किसान को नहीं दिखता।', 'Reserves room for what the farmer USUALLY brings (said 80, brought 92), learned from his history. Invisible to the farmer.', 'ਕਿਸਾਨ ਦੀ ਪੁਰਾਣੀ ਆਦਤ ਤੋਂ ਅਸਲੀ ਮਾਤਰਾ ਦਾ ਅੰਦਾਜ਼ਾ।', 'शेतकऱ्याच्या जुन्या सवयीवरून खऱ्या प्रमाणाचा अंदाज.'),
  en_modelC: r('मॉडल C · न आने की संभावना', 'Model C · no-show prediction', 'ਮਾਡਲ C · ਨਾ ਆਉਣ ਦੀ ਸੰਭਾਵਨਾ', 'मॉडेल C · न येण्याची शक्यता'),
  en_modelCSub: r('लॉजिस्टिक रिग्रेशन: कौन नहीं आएगा। उसकी जगह सिर्फ बफर में दोबारा दी जाती है — पक्की बुकिंग कभी नहीं हटती।', 'Logistic regression: who will not turn up. Their room is re-offered ONLY inside the buffer — confirmed bookings are never moved.', 'ਲੌਜਿਸਟਿਕ ਰਿਗ੍ਰੈਸ਼ਨ: ਕੌਣ ਨਹੀਂ ਆਵੇਗਾ।', 'लॉजिस्टिक रिग्रेशन: कोण येणार नाही.'),
  en_boardTitle: r('घंटा-दर-घंटा बोर्ड', 'Hour-by-hour board', 'ਘੰਟਾ-ਦਰ-ਘੰਟਾ ਬੋਰਡ', 'तासनिहाय बोर्ड'),
  en_boardSub: r('हल्का नीला = बुक (सब आएं तो), गहरा नीला = अपेक्षित (मॉडल के अनुसार), लाल रेखा = बफर की शुरुआत।', 'Light blue = booked (if everyone shows), dark blue = expected (per the models), red line = where the buffer starts.', 'ਹਲਕਾ ਨੀਲਾ = ਬੁੱਕ, ਗੂੜ੍ਹਾ ਨੀਲਾ = ਉਮੀਦ, ਲਾਲ ਲਕੀਰ = ਬਫ਼ਰ।', 'फिकट निळा = बुक, गडद निळा = अपेक्षित, लाल रेषा = बफर.'),
  en_booked: r('बुक', 'booked', 'ਬੁੱਕ', 'बुक'),
  en_expected: r('अपेक्षित', 'expected', 'ਉਮੀਦ', 'अपेक्षित'),
  en_declared: r('घोषित', 'declared', 'ਘੋਸ਼ਿਤ', 'घोषित'),
  en_reserved: r('आरक्षित', 'reserved', 'ਰਾਖਵਾਂ', 'राखीव'),
  en_actual: r('असली', 'actual', 'ਅਸਲੀ', 'प्रत्यक्ष'),
  en_vehicles: r('वाहन', 'vehicles', 'ਵਾਹਨ', 'वाहने'),
  en_inside: r('अंदर', 'inside', 'ਅੰਦਰ', 'आत'),
  en_paid: r('भुगतान', 'paid', 'ਭੁਗਤਾਨ', 'पेमेंट'),
  en_missed: r('चूके', 'missed', 'ਖੁੰਝੇ', 'चुकले'),
  en_rebooked: r('गेट पर बुक', 'booked at gate', 'ਗੇਟ ਤੇ ਬੁੱਕ', 'गेटवर बुक'),
  en_close: r('घंटा बंद करें', 'Close hour', 'ਘੰਟਾ ਬੰਦ ਕਰੋ', 'तास बंद करा'),
  en_reopen: r('घंटा खोलें', 'Reopen hour', 'ਘੰਟਾ ਖੋਲ੍ਹੋ', 'तास उघडा'),
  en_legend: r('* = सीखा हुआ थ्रूपुट लागू। बंद घंटे में नई बुकिंग नहीं; पहले से बने पास मान्य रहते हैं।', '* = learned throughput in use. A closed hour takes no new bookings; passes already issued stay valid.', '* = ਸਿੱਖਿਆ ਥਰੂਪੁੱਟ। ਬੰਦ ਘੰਟੇ ਵਿੱਚ ਨਵੀਂ ਬੁਕਿੰਗ ਨਹੀਂ।', '* = शिकलेला थ्रूपुट. बंद तासात नवीन बुकिंग नाही.'),
  en_healthTitle: r('मॉडल की सेहत (इसी मंडी के आंकड़े)', "Model health (this mandi's own data)", 'ਮਾਡਲ ਦੀ ਸਿਹਤ', 'मॉडेलचे आरोग्य'),
  en_errDeclared: r('किसान की घोषणा की औसत गलती', 'Average error of raw declared qty', 'ਘੋਸ਼ਿਤ ਮਾਤਰਾ ਦੀ ਔਸਤ ਗ਼ਲਤੀ', 'घोषित प्रमाणाची सरासरी चूक'),
  en_errEngine: r('इंजन के अनुमान की औसत गलती', "Average error of the engine's guess", 'ਇੰਜਣ ਦੇ ਅੰਦਾਜ਼ੇ ਦੀ ਔਸਤ ਗ਼ਲਤੀ', 'इंजिनच्या अंदाजाची सरासरी चूक'),
  en_showPred: r('अनुमानित उपस्थिति', 'Predicted show-rate', 'ਅਨੁਮਾਨਿਤ ਹਾਜ਼ਰੀ', 'अंदाजित उपस्थिती'),
  en_showReal: r('असली उपस्थिति', 'Actual show-rate', 'ਅਸਲੀ ਹਾਜ਼ਰੀ', 'प्रत्यक्ष उपस्थिती'),
  en_samples: r('तौल / बंद टोकन', 'weighings / closed tokens', 'ਤੋਲ / ਬੰਦ ਟੋਕਨ', 'तोलण्या / बंद टोकन'),
  en_needData: r('पहली तौल के बाद', 'after first weighing', 'ਪਹਿਲੀ ਤੋਲ ਤੋਂ ਬਾਅਦ', 'पहिल्या तोलणीनंतर'),
  en_retrain: r('इतिहास से दोबारा सिखाएं', 'Retrain from history', 'ਇਤਿਹਾਸ ਤੋਂ ਦੁਬਾਰਾ ਸਿਖਾਓ', 'इतिहासातून पुन्हा शिकवा'),
  en_retrainSub: r('इसी मंडी के बंद टोकनों पर मॉडल A और C को यहीं फोन/ब्राउज़र में दोबारा सिखाता है (सर्वर आने पर रोज़ रात अपने आप)। कम आंकड़ों पर शिप किए गए वज़न ही रहते हैं।', 'Retrains Models A and C right here in the browser on this mandi\'s closed tokens (nightly and automatic once the server exists). With too little data the shipped weights stay in use.', 'ਮਾਡਲ A ਤੇ C ਨੂੰ ਇੱਥੇ ਹੀ ਦੁਬਾਰਾ ਸਿਖਾਉਂਦਾ ਹੈ।', 'मॉडेल A व C येथेच पुन्हा शिकवते.'),
  en_retrained: r('मॉडल दोबारा सिखाए गए। मॉडल कार्ड देखें।', 'Models retrained. See the model card.', 'ਮਾਡਲ ਦੁਬਾਰਾ ਸਿਖਾਏ ਗਏ।', 'मॉडेल पुन्हा शिकवले.'),
  en_reset: r('इंजन की सीख मिटाएं', 'Reset engine learning', 'ਇੰਜਣ ਦੀ ਸਿੱਖ ਮਿਟਾਓ', 'इंजिनचे शिक्षण पुसा'),
  en_resetConfirm: r('इस मंडी के लिए सीखा हुआ थ्रूपुट, दोबारा सिखाए गए वज़न और स्विच फैक्ट्री सेटिंग पर लौट जाएंगे। टोकन/किसान डेटा नहीं मिटता।', 'Learned throughput, retrained weights and switches for this mandi go back to factory settings. Tokens and farmer records are NOT deleted.', 'ਸਿੱਖਿਆ ਥਰੂਪੁੱਟ ਤੇ ਵਜ਼ਨ ਫੈਕਟਰੀ ਸੈਟਿੰਗ ਤੇ ਜਾਣਗੇ। ਟੋਕਨ ਨਹੀਂ ਮਿਟਦੇ।', 'शिकलेले वजन फॅक्टरी सेटिंगवर जातील. टोकन पुसले जात नाहीत.'),
  en_resetDone: r('इंजन फैक्ट्री सेटिंग पर है। सीखना अगली बुकिंग से फिर शुरू।', 'Engine is back to factory settings. Learning restarts from the next booking.', 'ਇੰਜਣ ਫੈਕਟਰੀ ਸੈਟਿੰਗ ਤੇ ਹੈ।', 'इंजिन फॅक्टरी सेटिंगवर आहे.'),
  en_modelCard: r('मॉडल कार्ड (तकनीकी)', 'Model card (technical)', 'ਮਾਡਲ ਕਾਰਡ', 'मॉडेल कार्ड'),
  en_trainedOn: r('प्रशिक्षण डेटा', 'Trained on', 'ਸਿਖਲਾਈ ਡਾਟਾ', 'प्रशिक्षण डेटा'),
  en_thisMandi: r('इसी मंडी का इतिहास', 'this mandi\'s history', 'ਇਸੇ ਮੰਡੀ ਦਾ ਇਤਿਹਾਸ', 'याच मंडीचा इतिहास'),
  en_rows: r('पंक्तियाँ', 'rows', 'ਕਤਾਰਾਂ', 'ओळी'),
  en_weights: r('वज़न', 'weights', 'ਵਜ਼ਨ', 'वजने'),
  // install45: Aadhaar e-KYC (mock)
  aad_title: r('आधार सत्यापन', 'Aadhaar verification', 'ਆਧਾਰ ਤਸਦੀਕ', 'आधार पडताळणी'),
  aad_help: r('12 अंकों का आधार नंबर डालें। आधार से जुड़े मोबाइल पर OTP आएगा। ऐप में सिर्फ़ अंतिम 4 अंक सुरक्षित रहते हैं।', 'Enter your 12-digit Aadhaar. An OTP goes to the Aadhaar-linked mobile. The app keeps only the last 4 digits.', '12 ਅੰਕਾਂ ਦਾ ਆਧਾਰ ਨੰਬਰ ਪਾਓ। ਸਿਰਫ਼ ਆਖਰੀ 4 ਅੰਕ ਸੰਭਾਲੇ ਜਾਂਦੇ ਹਨ।', '12 अंकी आधार टाका. फक्त शेवटचे 4 अंक जतन होतात.'),
  aad_sendOtp: r('आधार OTP भेजें', 'Send Aadhaar OTP', 'ਆਧਾਰ OTP ਭੇਜੋ', 'आधार OTP पाठवा'),
  aad_otpSent: r('OTP मोबाइल {m} पर भेजा गया (डेमो: 1234)', 'OTP sent to mobile {m} (demo: 1234)', 'OTP ਮੋਬਾਈਲ {m} ਤੇ ਭੇਜਿਆ (ਡੈਮੋ: 1234)', 'OTP मोबाईल {m} वर पाठवला (डेमो: 1234)'),
  aad_otpPh: r('आधार OTP', 'Aadhaar OTP', 'ਆਧਾਰ OTP', 'आधार OTP'),
  aad_verify: r('सत्यापित करें', 'Verify', 'ਤਸਦੀਕ ਕਰੋ', 'पडताळा'),
  aad_changeNumber: r('नंबर बदलें', 'Change number', 'ਨੰਬਰ ਬਦਲੋ', 'क्रमांक बदला'),
  aad_verified: r('आधार सत्यापित ✓', 'Aadhaar verified ✓', 'ਆਧਾਰ ਤਸਦੀਕ ✓', 'आधार पडताळले ✓'),
  aad_mockTag: r('डेमो e-KYC', 'demo e-KYC', 'ਡੈਮੋ e-KYC', 'डेमो e-KYC'),
  aad_invalid: r('यह आधार नंबर सही नहीं है (चेकसम विफल)।', 'This Aadhaar number is not valid (checksum failed).', 'ਇਹ ਆਧਾਰ ਨੰਬਰ ਸਹੀ ਨਹੀਂ।', 'हा आधार क्रमांक योग्य नाही.'),
  aad_wrongOtp: r('गलत OTP। डेमो OTP 1234 है।', 'Wrong OTP. Demo OTP is 1234.', 'ਗ਼ਲਤ OTP। ਡੈਮੋ OTP 1234।', 'चुकीचा OTP. डेमो OTP 1234.'),
  aad_demoHint: r('डेमो नंबर: {n}', 'Demo numbers: {n}', 'ਡੈਮੋ ਨੰਬਰ: {n}', 'डेमो क्रमांक: {n}'),
  td_noMsp: r('इस फसल का कोई MSP नहीं है — कीमत केवल ई-नीलामी से तय होगी।', 'This crop has no MSP — the price is set by e-auction only.', 'ਇਸ ਫਸਲ ਦਾ MSP ਨਹੀਂ — ਕੀਮਤ ਸਿਰਫ਼ ਈ-ਨਿਲਾਮੀ ਤੋਂ।', 'या पिकाला MSP नाही — किंमत फक्त ई-लिलावाने.'),
  cs_auctionOnly: r('जल्दी खराब होने वाली • केवल नीलामी • आज/कल की बुकिंग', 'Perishable • auction only • book today/tomorrow', 'ਨਾਸ਼ਵਾਨ • ਸਿਰਫ਼ ਨਿਲਾਮੀ • ਅੱਜ/ਕੱਲ੍ਹ', 'नाशवंत • फक्त लिलाव • आज/उद्या'),
  gr_title: r('गेट पर बुकिंग', 'Book at gate', 'ਗੇਟ ਤੇ ਬੁਕਿੰਗ', 'गेटवर बुकिंग'),
  gr_walkTitle: r('बिना बुकिंग आया किसान', 'Farmer without a booking', 'ਬਿਨਾਂ ਬੁਕਿੰਗ ਕਿਸਾਨ', 'बुकिंगशिवाय शेतकरी'),
  gr_walkSub: r('आज का अगला खाली घंटा दिया जाएगा। पहले से बुक किसी को नहीं हटाया जाता।', 'He gets the next hour today with room. Nobody already booked is moved.', 'ਅੱਜ ਦਾ ਅਗਲਾ ਖਾਲੀ ਘੰਟਾ ਮਿਲੇਗਾ। ਪਹਿਲਾਂ ਬੁੱਕ ਕਿਸੇ ਨੂੰ ਨਹੀਂ ਹਟਾਇਆ ਜਾਂਦਾ।', 'आजचा पुढील रिकामा तास मिळेल. आधी बुक केलेल्या कोणालाही हलवले जात नाही.'),
  gr_lateTitle: r('समय निकला — नई बुकिंग', 'Slot missed — new booking', 'ਸਮਾਂ ਲੰਘਿਆ — ਨਵੀਂ ਬੁਕਿੰਗ', 'वेळ गेली — नवीन बुकिंग'),
  gr_lateSub: r('पुराना पास ({t}) बंद होगा और उसकी जगह खाली होगी। नीचे मात्रा जांचें।', 'The old pass ({t}) is closed and its room released. Check the quantity below.', 'ਪੁਰਾਣਾ ਪਾਸ ({t}) ਬੰਦ ਹੋਵੇਗਾ। ਮਾਤਰਾ ਜਾਂਚੋ।', 'जुना पास ({t}) बंद होईल. खाली प्रमाण तपासा.'),
  gr_enterPhone: r('किसान का 10 अंकों का मोबाइल नंबर दर्ज करें।', 'Enter the farmer\'s 10-digit mobile number.', 'ਕਿਸਾਨ ਦਾ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'शेतकऱ्याचा 10 अंकी मोबाइल क्रमांक टाका.'),
  gr_note: r('छोटी खेप प्रायः इसी या अगले घंटे में लग जाती है; बड़ी खेप को बाद का समय मिल सकता है। आज जगह न हो तो कल के लिए ऐप से बुक करें।', 'Small loads usually fit this or the next hour; big loads may get a later hour. If no room today, book tomorrow from the app.', 'ਛੋਟੀ ਖੇਪ ਇਸੇ ਜਾਂ ਅਗਲੇ ਘੰਟੇ; ਵੱਡੀ ਨੂੰ ਬਾਅਦ ਦਾ ਸਮਾਂ। ਅੱਜ ਥਾਂ ਨਾ ਹੋਵੇ ਤਾਂ ਕੱਲ੍ਹ ਲਈ ਬੁੱਕ ਕਰੋ।', 'लहान माल याच किंवा पुढच्या तासात; मोठ्याला नंतरची वेळ. आज जागा नसेल तर उद्यासाठी बुक करा.'),
  gr_find: r('खाली घंटा खोजें और पास दें', 'Find room & issue pass', 'ਖਾਲੀ ਘੰਟਾ ਲੱਭੋ ਤੇ ਪਾਸ ਦਿਓ', 'रिकामा तास शोधा व पास द्या'),
  gr_noRoom: r('आज जगह नहीं', 'No room today', 'ਅੱਜ ਥਾਂ ਨਹੀਂ', 'आज जागा नाही'),
  gr_noRoomSub: r('आज के बचे घंटों में {q} क्विंटल के लिए जगह नहीं है। किसान को कल के लिए बुक करने को कहें।', 'No remaining hour today has room for {q} quintals. Ask the farmer to book for tomorrow.', 'ਅੱਜ ਦੇ ਬਾਕੀ ਘੰਟਿਆਂ ਵਿੱਚ {q} ਕੁਇੰਟਲ ਲਈ ਥਾਂ ਨਹੀਂ। ਕੱਲ੍ਹ ਲਈ ਬੁੱਕ ਕਰਨ ਲਈ ਕਹੋ।', 'आजच्या उरलेल्या तासांत {q} क्विंटलसाठी जागा नाही. उद्यासाठी बुक करायला सांगा.'),
  gr_done: r('नया पास जारी', 'New pass issued', 'ਨਵਾਂ ਪਾਸ ਜਾਰੀ', 'नवीन पास दिला'),
  gr_tellFarmer: r('किसान को बताएं — गेट पास नंबर: {code}', 'Tell the farmer — gate pass number: {code}', 'ਕਿਸਾਨ ਨੂੰ ਦੱਸੋ — ਗੇਟ ਪਾਸ ਨੰਬਰ: {code}', 'शेतकऱ्याला सांगा — गेट पास क्रमांक: {code}'),
  gr_waitHint: r('किसान {t} बजे गेट पर आए। ऐप में लॉग इन करने पर यही पास दिखेगा।', 'The farmer comes to the gate at {t}. The same pass appears in the app when he logs in.', 'ਕਿਸਾਨ {t} ਵਜੇ ਗੇਟ ਤੇ ਆਵੇ। ਐਪ ਵਿੱਚ ਇਹੀ ਪਾਸ ਦਿਖੇਗਾ।', 'शेतकरी {t} वाजता गेटवर यावा. अ‍ॅपमध्ये हाच पास दिसेल.'),
  qty_title: r('फसल की मात्रा', 'Crop quantity', 'ਫਸਲ ਦੀ ਮਾਤਰਾ', 'पिकाचे प्रमाण'),
  qty_sub: r('लगभग कितनी फसल ला रहे हैं? (क्विंटल में)', 'About how much crop are you bringing? (in quintals)', 'ਲਗਭਗ ਕਿੰਨੀ ਫਸਲ ਲਿਆ ਰਹੇ ਹੋ? (ਕੁਇੰਟਲ ਵਿੱਚ)', 'साधारण किती पीक आणत आहात? (क्विंटलमध्ये)'),
  qty_summary: r('आपकी बुकिंग', 'Your booking', 'ਤੁਹਾਡੀ ਬੁਕਿੰਗ', 'तुमची बुकिंग'),
  qty_hint: r('1 क्विंटल = 100 किलो। अंदाज़ा ही काफी है, सही वजन तौल पर होगा।', '1 quintal = 100 kg. An estimate is fine; exact weight is taken at the weighbridge.', '1 ਕੁਇੰਟਲ = 100 ਕਿਲੋ। ਅੰਦਾਜ਼ਾ ਕਾਫ਼ੀ ਹੈ, ਸਹੀ ਵਜ਼ਨ ਤੋਲ ਤੇ ਹੋਵੇਗਾ।', '1 क्विंटल = 100 किलो. अंदाज पुरेसा आहे; अचूक वजन वजनकाट्यावर होईल.'),
  audio_qty: r(
    'चौथा चरण। प्लस और माइनस बटन से बताएं कि आप लगभग कितने क्विंटल फसल ला रहे हैं, फिर पुष्टि करें और टोकन लें।',
    'Step four. Use the plus and minus buttons to tell us roughly how many quintals you are bringing, then confirm and get your token.',
    'ਚੌਥਾ ਪੜਾਅ। ਪਲੱਸ ਅਤੇ ਮਾਈਨਸ ਬਟਨ ਨਾਲ ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਲਗਭਗ ਕਿੰਨੇ ਕੁਇੰਟਲ ਫਸਲ ਲਿਆ ਰਹੇ ਹੋ, ਫਿਰ ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਟੋਕਨ ਲਓ।',
    'चौथी पायरी. प्लस आणि मायनस बटणांनी सांगा की तुम्ही साधारण किती क्विंटल पीक आणत आहात, मग पुष्टी करा आणि टोकन घ्या.'
  ),

  /* ------------------------------------------------------------
   * install28: notifications (bell, banner, phone notifications)
   * ------------------------------------------------------------ */
  nt_title: r('सूचनाएं', 'Notifications', 'ਸੂਚਨਾਵਾਂ', 'सूचना'),
  nt_pushOn: r('फ़ोन सूचनाएं चालू हैं (ऐप बंद होने पर भी)', 'Phone notifications ON (even when app is closed)', 'ਫ਼ੋਨ ਸੂਚਨਾਵਾਂ ਚਾਲੂ ਹਨ', 'फोन सूचना चालू आहेत'),
  nt_pushOff: r('फ़ोन सूचनाएं बंद हैं - केवल ऐप खुला होने पर', 'Phone notifications OFF - only while app is open', 'ਫ਼ੋਨ ਸੂਚਨਾਵਾਂ ਬੰਦ ਹਨ', 'फोन सूचना बंद आहेत'),
  nt_testBtn: r('टेस्ट सूचना भेजें', 'Send test notification', 'ਟੈਸਟ ਸੂਚਨਾ ਭੇਜੋ', 'चाचणी सूचना पाठवा'),
  nt_testBody: r('टेस्ट सफल! ऐप बंद होने पर भी सूचना आएगी।', 'Test OK! Notifications reach you even when the app is closed.', 'ਟੈਸਟ ਸਫਲ!', 'चाचणी यशस्वी!'),
  nt_testSent: r('भेजा गया - अब ऐप बंद करके देखें', 'Sent - now close the app and watch', 'ਭੇਜਿਆ ਗਿਆ', 'पाठवले'),
  nt_testFail: r('भेजना असफल - ऊपर कारण देखें', 'Failed - see reason above', 'ਅਸਫਲ', 'अयशस्वी'),
  nt_sub: r('आपके टोकन और मंडी की खबर', 'Updates on your token and mandi', 'ਤੁਹਾਡੇ ਟੋਕਨ ਅਤੇ ਮੰਡੀ ਦੀ ਖ਼ਬਰ', 'तुमच्या टोकन व मंडीच्या बातम्या'),
  nt_empty: r('अभी कोई सूचना नहीं। टोकन बुक करते ही यहां खबर आएगी।', 'No notifications yet. Updates appear here as soon as something happens.', 'ਹਾਲੇ ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ।', 'अजून सूचना नाही.'),
  nt_justNow: r('अभी', 'just now', 'ਹੁਣੇ', 'आत्ताच'),
  nt_minAgo: r('{n} मिनट पहले', '{n} min ago', '{n} ਮਿੰਟ ਪਹਿਲਾਂ', '{n} मिनिटांपूर्वी'),
  nt_hrAgo: r('{n} घंटे पहले', '{n} h ago', '{n} ਘੰਟੇ ਪਹਿਲਾਂ', '{n} तासांपूर्वी'),

  // farmer
  nt_booked_t: r('टोकन बुक हो गया', 'Token booked', 'ਟੋਕਨ ਬੁੱਕ ਹੋ ਗਿਆ', 'टोकन बुक झाले'),
  nt_booked_b: r('टोकन {token} • {mandi} • {date}। गेट पर {time} बजे पहुंचें।', 'Token {token} • {mandi} • {date}. Arrive at the gate at {time}.', 'ਟੋਕਨ {token} • {mandi} • {date}। ਗੇਟ ਤੇ {time} ਵਜੇ ਪਹੁੰਚੋ।', 'टोकन {token} • {mandi} • {date}. गेटवर {time} वाजता पोहोचा.'),
  nt_remEve_t: r('कल मंडी जाना है', 'Mandi visit tomorrow', 'ਕੱਲ੍ਹ ਮੰਡੀ ਜਾਣਾ ਹੈ', 'उद्या मंडीत जायचे आहे'),
  nt_remEve_b: r('टोकन {token}, {mandi}, {time}। आधार, बैंक पासबुक और तिरपाल साथ रखें।', 'Token {token}, {mandi}, {time}. Carry Aadhaar, bank passbook and tarpaulin.', 'ਟੋਕਨ {token}, {mandi}, {time}। ਆਧਾਰ, ਪਾਸਬੁੱਕ ਅਤੇ ਤਿਰਪਾਲ ਨਾਲ ਰੱਖੋ।', 'टोकन {token}, {mandi}, {time}. आधार, पासबुक व ताडपत्री सोबत ठेवा.'),
  nt_remHour_t: r('एक घंटे में आपका स्लॉट', 'Your slot is in one hour', 'ਇੱਕ ਘੰਟੇ ਵਿੱਚ ਤੁਹਾਡਾ ਸਲਾਟ', 'एका तासात तुमचा स्लॉट'),
  nt_remHour_b: r('टोकन {token} • {mandi} • {time}। अब निकल जाइए।', 'Token {token} • {mandi} • {time}. Time to leave.', 'ਟੋਕਨ {token} • {mandi} • {time}। ਹੁਣ ਨਿਕਲੋ।', 'टोकन {token} • {mandi} • {time}. आता निघा.'),
  nt_yourTurn_t: r('आपकी बारी है - गेट पर जाएं', 'Your turn — go to the gate', 'ਤੁਹਾਡੀ ਵਾਰੀ ਹੈ - ਗੇਟ ਤੇ ਜਾਓ', 'तुमची पाळी - गेटवर जा'),
  nt_yourTurn_b: r('टोकन {token}। एक लेन खाली है, गेट पर QR दिखाएं।', 'Token {token}. A lane is free — show your QR at the gate.', 'ਟੋਕਨ {token}। ਲੇਨ ਖਾਲੀ ਹੈ, ਗੇਟ ਤੇ QR ਦਿਖਾਓ।', 'टोकन {token}. लेन रिकामी आहे, गेटवर QR दाखवा.'),
  nt_gate_t: r('मंडी में प्रवेश हो गया', 'Entered the mandi', 'ਮੰਡੀ ਵਿੱਚ ਦਾਖਲਾ ਹੋ ਗਿਆ', 'मंडीत प्रवेश झाला'),
  nt_gate_b: r('टोकन {token}। अब जांच (assay) के लिए जाएं।', 'Token {token}. Proceed to quality check (assay).', 'ਟੋਕਨ {token}। ਹੁਣ ਜਾਂਚ ਲਈ ਜਾਓ।', 'टोकन {token}. आता तपासणीसाठी जा.'),
  nt_gate_lane_b: r('टोकन {token}। लेन {lane} में गाड़ी लगाएं, फिर जांच होगी।', 'Token {token}. Park in lane {lane}; quality check is next.', 'ਟੋਕਨ {token}। ਲੇਨ {lane} ਵਿੱਚ ਗੱਡੀ ਲਗਾਓ।', 'टोकन {token}. लेन {lane} मध्ये गाडी लावा.'),
  nt_assay_t: r('जांच पूरी - आपका फैसला चाहिए', 'Quality check done — your decision needed', 'ਜਾਂਚ ਪੂਰੀ - ਤੁਹਾਡਾ ਫੈਸਲਾ ਚਾਹੀਦਾ', 'तपासणी पूर्ण - तुमचा निर्णय हवा'),
  nt_assay_b: r('ग्रेड {grade}। MSP पर बेचें या नीलामी चुनें - ऐप खोलें।', 'Grade {grade}. Choose MSP or auction — open the app.', 'ਗ੍ਰੇਡ {grade}। MSP ਜਾਂ ਨੀਲਾਮੀ ਚੁਣੋ।', 'ग्रेड {grade}. MSP किंवा लिलाव निवडा.'),
  nt_rejected_t: r('फसल अस्वीकृत', 'Produce rejected', 'ਫਸਲ ਅਸਵੀਕਾਰ', 'पीक नाकारले'),
  nt_rejected_b: r('टोकन {token} की जांच में फसल मानक पर खरी नहीं उतरी। विवरण ऐप में देखें।', 'Token {token} did not meet quality standards. See details in the app.', 'ਟੋਕਨ {token} ਮਿਆਰ ਤੇ ਖਰਾ ਨਹੀਂ ਉਤਰਿਆ।', 'टोकन {token} दर्जा निकषात बसले नाही.'),
  nt_price_t: r('भाव तय हुआ', 'Price fixed', 'ਭਾਅ ਤੈਅ ਹੋਇਆ', 'भाव ठरला'),
  nt_price_b: r('₹{rate} प्रति क्विंटल। अब तौल के लिए जाएं।', '₹{rate} per quintal. Proceed to the weighbridge.', '₹{rate} ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਹੁਣ ਤੋਲ ਲਈ ਜਾਓ।', '₹{rate} प्रति क्विंटल. आता वजनासाठी जा.'),
  nt_weighed_t: r('तौल पूरी', 'Weighing done', 'ਤੋਲ ਪੂਰੀ', 'वजन पूर्ण'),
  nt_weighed_b: r('{qty} क्विंटल @ ₹{rate}। भुगतान काउंटर पर जाएं।', '{qty} quintals @ ₹{rate}. Go to the payment counter.', '{qty} ਕੁਇੰਟਲ @ ₹{rate}। ਭੁਗਤਾਨ ਕਾਊਂਟਰ ਤੇ ਜਾਓ।', '{qty} क्विंटल @ ₹{rate}. पेमेंट काउंटरवर जा.'),
  nt_paid_t: r('भुगतान हो गया', 'Payment done', 'ਭੁਗਤਾਨ ਹੋ ਗਿਆ', 'पेमेंट झाले'),
  nt_paid_b: r('₹{amount} आपके खाते में भेजे गए। रसीद ऐप में है।', '₹{amount} sent to your bank account. Receipt is in the app.', '₹{amount} ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਭੇਜੇ ਗਏ।', '₹{amount} तुमच्या खात्यात पाठवले.'),
  nt_missed_t: r('समय निकल गया', 'Slot missed', 'ਸਮਾਂ ਲੰਘ ਗਿਆ', 'वेळ चुकली'),
  nt_missed_b: r('{mandi} में आपका समय निकल गया। ऐप खोलकर बताएं — देर हो गई है (फिर से बुक करें) या आज नहीं आएंगे।', 'Your slot at {mandi} has passed. Open the app and tell us — running late (re-book me) or not coming today.', '{mandi} ਵਿੱਚ ਤੁਹਾਡਾ ਸਮਾਂ ਲੰਘ ਗਿਆ। ਐਪ ਖੋਲ੍ਹ ਕੇ ਦੱਸੋ — ਦੇਰ ਹੋ ਗਈ ਜਾਂ ਨਹੀਂ ਆਓਗੇ।', '{mandi} मध्ये तुमची वेळ निघून गेली. अॅप उघडून सांगा — उशीर झाला की येणार नाही.'),
  nt_noShow_t: r('टोकन रद्द (अनुपस्थित)', 'Token cancelled (no-show)', 'ਟੋਕਨ ਰੱਦ (ਗੈਰਹਾਜ਼ਰ)', 'टोकन रद्द (गैरहजर)'),
  nt_noShow_b: r('टोकन {token} समय पर नहीं आया। नया स्लॉट बुक करें।', 'Token {token} did not arrive in time. Please book a new slot.', 'ਟੋਕਨ {token} ਸਮੇਂ ਤੇ ਨਹੀਂ ਆਇਆ। ਨਵਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰੋ।', 'टोकन {token} वेळेत आले नाही. नवीन स्लॉट बुक करा.'),
  nt_delay_t: r('मंडी में देरी', 'Delay at the mandi', 'ਮੰਡੀ ਵਿੱਚ ਦੇਰੀ', 'मंडीत उशीर'),
  nt_delay_b: r('लगभग {minutes} मिनट की देरी: {reason}', 'About {minutes} min delay: {reason}', 'ਲਗਭਗ {minutes} ਮਿੰਟ ਦੀ ਦੇਰੀ: {reason}', 'सुमारे {minutes} मिनिटे उशीर: {reason}'),
  nt_auctionBid_t: r('नई बोली आई', 'New bid received', 'ਨਵੀਂ ਬੋਲੀ ਆਈ', 'नवीन बोली आली'),
  nt_auctionBid_b: r('{crop} पर ₹{bid}/क्विंटल की बोली ({bidder})।', '₹{bid}/quintal bid on your {crop} ({bidder}).', '{crop} ਤੇ ₹{bid}/ਕੁਇੰਟਲ ਦੀ ਬੋਲੀ।', '{crop} वर ₹{bid}/क्विंटल बोली.'),

  // officers
  nt_off_newToken_t: r('नया टोकन', 'New token', 'ਨਵਾਂ ਟੋਕਨ', 'नवीन टोकन'),
  nt_off_newToken_b: r('{token} • {farmer} • {crop} {qty} क्विं • {date} {time}', '{token} • {farmer} • {crop} {qty} q • {date} {time}', '{token} • {farmer} • {crop} {qty} ਕੁਇੰ • {date} {time}', '{token} • {farmer} • {crop} {qty} क्विं • {date} {time}'),
  nt_off_arrived_t: r('गाड़ी अंदर आई - जांच के लिए', 'Vehicle in — ready for assay', 'ਗੱਡੀ ਅੰਦਰ ਆਈ - ਜਾਂਚ ਲਈ', 'गाडी आत आली - तपासणीसाठी'),
  nt_off_arrived_b: r('{token} • {farmer} • {crop} • लेन {lane}', '{token} • {farmer} • {crop} • lane {lane}', '{token} • {farmer} • {crop} • ਲੇਨ {lane}', '{token} • {farmer} • {crop} • लेन {lane}'),
  nt_off_priceFixed_t: r('भाव तय - तौल के लिए तैयार', 'Price fixed — ready to weigh', 'ਭਾਅ ਤੈਅ - ਤੋਲ ਲਈ ਤਿਆਰ', 'भाव ठरला - वजनासाठी तयार'),
  nt_off_priceFixed_b: r('{token} • {farmer} • {crop} @ ₹{rate}', '{token} • {farmer} • {crop} @ ₹{rate}', '{token} • {farmer} • {crop} @ ₹{rate}', '{token} • {farmer} • {crop} @ ₹{rate}'),
  nt_off_weighed_t: r('तौल पूरी - भुगतान बाकी', 'Weighed — payment pending', 'ਤੋਲ ਪੂਰੀ - ਭੁਗਤਾਨ ਬਾਕੀ', 'वजन पूर्ण - पेमेंट बाकी'),
  nt_off_weighed_b: r('{token} • {farmer} • {qty} क्विं @ ₹{rate}', '{token} • {farmer} • {qty} q @ ₹{rate}', '{token} • {farmer} • {qty} ਕੁਇੰ @ ₹{rate}', '{token} • {farmer} • {qty} क्विं @ ₹{rate}'),

  // traders
  nt_tr_newLot_t: r('नई नीलामी शुरू', 'New auction open', 'ਨਵੀਂ ਨੀਲਾਮੀ ਸ਼ੁਰੂ', 'नवीन लिलाव सुरू'),
  nt_tr_newLot_b: r('{crop} {qty} क्विं, ग्रेड {grade}, न्यूनतम ₹{msp}। {minutes} मिनट में बंद।', '{crop} {qty} q, grade {grade}, reserve ₹{msp}. Closes in {minutes} min.', '{crop} {qty} ਕੁਇੰ, ਗ੍ਰੇਡ {grade}, ਘੱਟੋ-ਘੱਟ ₹{msp}। {minutes} ਮਿੰਟ ਵਿੱਚ ਬੰਦ।', '{crop} {qty} क्विं, ग्रेड {grade}, किमान ₹{msp}. {minutes} मिनिटांत बंद.'),
  nt_tr_outbid_t: r('आपकी बोली पीछे रह गई', 'You have been outbid', 'ਤੁਹਾਡੀ ਬੋਲੀ ਪਿੱਛੇ ਰਹਿ ਗਈ', 'तुमची बोली मागे पडली'),
  nt_tr_outbid_b: r('{crop} ({token}) पर अब ₹{bid}/क्विं। फिर बोली लगाएं?', '{crop} ({token}) is now at ₹{bid}/q. Bid again?', '{crop} ({token}) ਤੇ ਹੁਣ ₹{bid}/ਕੁਇੰ।', '{crop} ({token}) आता ₹{bid}/क्विं.'),
  nt_tr_won_t: r('बधाई - लॉट आपका हुआ', 'Congratulations — lot is yours', 'ਵਧਾਈ - ਲਾਟ ਤੁਹਾਡਾ ਹੋਇਆ', 'अभिनंदन - लॉट तुमचा'),
  nt_tr_won_b: r('{crop} {qty} क्विं @ ₹{bid} ({token})। तौल के बाद भुगतान करें।', '{crop} {qty} q @ ₹{bid} ({token}). Pay after weighing.', '{crop} {qty} ਕੁਇੰ @ ₹{bid} ({token})।', '{crop} {qty} क्विं @ ₹{bid} ({token}).'),
  nt_tr_lost_t: r('लॉट किसी और को मिला', 'Lot went to another trader', 'ਲਾਟ ਕਿਸੇ ਹੋਰ ਨੂੰ ਮਿਲਿਆ', 'लॉट दुसऱ्याला मिळाला'),
  nt_tr_lost_b: r('{crop} ({token}) ₹{bid} पर बिका।', '{crop} ({token}) sold at ₹{bid}.', '{crop} ({token}) ₹{bid} ਤੇ ਵਿਕਿਆ।', '{crop} ({token}) ₹{bid} ला विकले.'),
  audio_Notifications: r(
    'यह आपकी सूचनाओं की सूची है। टोकन बुक होने, गेट प्रवेश, जांच, भाव, तौल और भुगतान की हर खबर यहां आती है। किसी सूचना पर दबाकर उसका विवरण देखें।',
    'This is your list of notifications. Booking, gate entry, quality check, price, weighing and payment updates all appear here. Tap one to see its details.',
    'ਇਹ ਤੁਹਾਡੀਆਂ ਸੂਚਨਾਵਾਂ ਦੀ ਸੂਚੀ ਹੈ। ਬੁਕਿੰਗ, ਗੇਟ, ਜਾਂਚ, ਭਾਅ, ਤੋਲ ਅਤੇ ਭੁਗਤਾਨ ਦੀ ਹਰ ਖ਼ਬਰ ਇੱਥੇ ਆਉਂਦੀ ਹੈ।',
    'ही तुमच्या सूचनांची यादी आहे. बुकिंग, गेट, तपासणी, भाव, वजन आणि पेमेंटच्या सर्व बातम्या इथे येतात.'
  ),

  confirmToken: r('पुष्टि करें और टोकन लें', 'Confirm & Get Token', 'ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਟੋਕਨ ਲਓ', 'पुष्टी करा आणि टोकन घ्या'),

  /* ------------------------------------------------------------ */
  /* Token confirmation + gate pass                                */
  /* ------------------------------------------------------------ */
  tc_booked: r('गेट पास बुक हो गया!', 'Gate pass booked!', 'ਗੇਟ ਪਾਸ ਬੁੱਕ ਹੋ ਗਿਆ!', 'गेट पास बुक झाला!'),
  tc_yourToken: r('आपका समय', 'Your slot', 'ਤੁਹਾਡਾ ਸਮਾਂ', 'तुमची वेळ'),
  tc_eta: r('गेट पर {t} बजे पहुंचें', 'Arrive at the gate at {t}', 'ਗੇਟ ਤੇ {t} ਵਜੇ ਪਹੁੰਚੋ', 'गेटवर {t} वाजता पोहोचा'),
  tc_finish: r('अनुमानित समाप्ति: {t}', 'Expected to finish by {t}', 'ਅਨੁਮਾਨਿਤ ਸਮਾਪਤੀ: {t}', 'अंदाजे पूर्ण: {t}'),
  tc_savePass: r('⬇  गेट पास PDF सेव करें', '⬇  Save gate pass PDF', '⬇  ਗੇਟ ਪਾਸ PDF ਸੰਭਾਲੋ', '⬇  गेट पास PDF जतन करा'),
  tc_whatAtGate: r('गेट पर क्या करें?', 'What to do at the gate?', 'ਗੇਟ ਤੇ ਕੀ ਕਰਨਾ ਹੈ?', 'गेटवर काय करावे?'),
  tc_tip1: r('1. यह QR या 6-अंकों का गेट पास नंबर दिखाएँ', '1. Show this QR or the 6-digit gate pass number', '1. ਇਹ QR ਜਾਂ 6-ਅੰਕਾਂ ਦਾ ਗੇਟ ਪਾਸ ਨੰਬਰ ਦਿਖਾਓ', '1. हा QR किंवा 6-अंकी गेट पास क्रमांक दाखवा'),
  tc_tip2: r('2. अपना वाहन नंबर बताएँ', '2. Tell your vehicle number', '2. ਆਪਣਾ ਵਾਹਨ ਨੰਬਰ ਦੱਸੋ', '2. तुमचा वाहन क्रमांक सांगा'),
  tc_tip3: r('3. गेट अधिकारी आपको अंदर भेजेंगे', '3. The gate officer will let you in', '3. ਗੇਟ ਅਧਿਕਾਰੀ ਤੁਹਾਨੂੰ ਅੰਦਰ ਭੇਜਣਗੇ', '3. गेट अधिकारी तुम्हाला आत पाठवतील'),
  tc_tipNote: r('यह गेट पास आपके टोकन पेज पर भी हमेशा उपलब्ध रहेगा।', 'This gate pass is always available on your token page.', 'ਇਹ ਗੇਟ ਪਾਸ ਤੁਹਾਡੇ ਟੋਕਨ ਪੇਜ ਤੇ ਹਮੇਸ਼ਾ ਉਪਲਬਧ ਰਹੇਗਾ।', 'हा गेट पास तुमच्या टोकन पेजवर नेहमी उपलब्ध असेल.'),
  tc_noBooking: r('बुकिंग जानकारी नहीं मिली', 'Booking details not found', 'ਬੁਕਿੰਗ ਜਾਣਕਾਰੀ ਨਹੀਂ ਮਿਲੀ', 'बुकिंग माहिती सापडली नाही'),
  goDashboard: r('डैशबोर्ड पर जाएँ', 'Go to Dashboard', 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਜਾਓ', 'डॅशबोर्डवर जा'),
  gp_title: r('🎫 गेट पास / GATE PASS', '🎫 GATE PASS', '🎫 ਗੇਟ ਪਾਸ / GATE PASS', '🎫 गेट पास / GATE PASS'),
  gp_number: r('गेट पास नंबर', 'Gate pass number', 'ਗੇਟ ਪਾਸ ਨੰਬਰ', 'गेट पास क्रमांक'),
  gp_dateTime: r('तारीख • समय', 'Date • Time', 'ਤਾਰੀਖ • ਸਮਾਂ', 'तारीख • वेळ'),
  gp_hint: r('गेट पर यह QR या नंबर और वाहन नंबर दिखाएँ', 'Show this QR or number with your vehicle number at the gate', 'ਗੇਟ ਤੇ ਇਹ QR ਜਾਂ ਨੰਬਰ ਅਤੇ ਵਾਹਨ ਨੰਬਰ ਦਿਖਾਓ', 'गेटवर हा QR किंवा क्रमांक आणि वाहन क्रमांक दाखवा'),

  /* ------------------------------------------------------------ */
  /* Token detail                                                  */
  /* ------------------------------------------------------------ */
  td_notFound: r('टोकन नहीं मिला', 'Token not found', 'ਟੋਕਨ ਨਹੀਂ ਮਿਲਿਆ', 'टोकन सापडले नाही'),
  td_yourToken: r('आपका टोकन', 'Your token', 'ਤੁਹਾਡਾ ਟੋਕਨ', 'तुमचे टोकन'),
  td_downloadPass: r('⬇  गेट पास PDF डाउनलोड करें', '⬇  Download gate pass PDF', '⬇  ਗੇਟ ਪਾਸ PDF ਡਾਊਨਲੋਡ ਕਰੋ', '⬇  गेट पास PDF डाउनलोड करा'),
  td_progress: r('प्रगति', 'Progress', 'ਪ੍ਰਗਤੀ', 'प्रगती'),
  stage_booked: r('बुकिंग हुई', 'Booked', 'ਬੁਕਿੰਗ ਹੋਈ', 'बुकिंग झाली'),
  stage_gate: r('गेट प्रवेश', 'Gate entry', 'ਗੇਟ ਐਂਟਰੀ', 'गेट प्रवेश'),
  stage_assay: r('गुणवत्ता जांच', 'Quality check', 'ਗੁਣਵੱਤਾ ਜਾਂਚ', 'गुणवत्ता तपासणी'),
  stage_price: r('भाव तय (MSP / नीलामी)', 'Price fixed (MSP / auction)', 'ਭਾਅ ਤੈਅ (MSP / ਨੀਲਾਮੀ)', 'भाव निश्चित (MSP / लिलाव)'),
  stage_weigh: r('तौल', 'Weighing', 'ਤੋਲ', 'वजन'),
  stage_payReady: r('भुगतान तैयार', 'Payment ready', 'ਭੁਗਤਾਨ ਤਿਆਰ', 'पेमेंट तयार'),
  stage_paid: r('भुगतान पूरा', 'Paid', 'ਭੁਗਤਾਨ ਪੂਰਾ', 'पेमेंट पूर्ण'),
  stage_done: r('पूरा हुआ', 'Done', 'ਪੂਰਾ ਹੋਇਆ', 'पूर्ण'),
  stage_now: r('अभी चल रहा है', 'In progress', 'ਹੁਣ ਚੱਲ ਰਿਹਾ', 'सुरू आहे'),
  stage_pending: r('बाकी', 'Pending', 'ਬਾਕੀ', 'बाकी'),
  td_bookingDetails: r('बुकिंग विवरण', 'Booking details', 'ਬੁਕਿੰਗ ਵੇਰਵਾ', 'बुकिंग तपशील'),
  td_atGate: r('गेट पर दर्ज होगा', 'Recorded at gate', 'ਗੇਟ ਤੇ ਦਰਜ ਹੋਵੇਗਾ', 'गेटवर नोंद होईल'),
  td_fixPrice: r('भाव तय करें', 'Fix your price', 'ਭਾਅ ਤੈਅ ਕਰੋ', 'भाव ठरवा'),
  td_fixPriceHint: r('जांच पूरी हो गई (ग्रेड {grade})। अब बताएं कि आप कैसे बेचना चाहते हैं। भाव तय होने के बाद ही तौल होगा।', 'Assay is done (grade {grade}). Choose how you want to sell. Weighing happens only after the price is fixed.', 'ਜਾਂਚ ਪੂਰੀ (ਗ੍ਰੇਡ {grade})। ਦੱਸੋ ਕਿਵੇਂ ਵੇਚਣਾ ਹੈ। ਭਾਅ ਤੈਅ ਹੋਣ ਬਾਅਦ ਹੀ ਤੋਲ ਹੋਵੇਗਾ।', 'तपासणी पूर्ण (ग्रेड {grade}). कसे विकायचे ते निवडा. भाव ठरल्यानंतरच वजन होईल.'),
  td_mspTitle: r('सरकारी खरीद (MSP)', 'Government purchase (MSP)', 'ਸਰਕਾਰੀ ਖਰੀਦ (MSP)', 'शासकीय खरेदी (MSP)'),
  td_mspSub: r('निश्चित भाव, तुरंत आगे बढ़ें', 'Fixed price, proceed immediately', 'ਪੱਕਾ ਭਾਅ, ਤੁਰੰਤ ਅੱਗੇ ਵਧੋ', 'निश्चित भाव, लगेच पुढे जा'),
  td_sellMsp: r('MSP पर बेचें', 'Sell at MSP', 'MSP ਤੇ ਵੇਚੋ', 'MSP ला विका'),
  td_sellMspConfirm: r('MSP पर बेचें?', 'Sell at MSP?', 'MSP ਤੇ ਵੇਚੀਏ?', 'MSP ला विकायचे?'),
  td_sellMspConfirmSub: r('₹{msp} प्रति क्विंटल पर सरकारी एजेंसी को बेचने की पुष्टि करें। इसके बाद तौल होगा।', 'Confirm sale to the government agency at ₹{msp} per quintal. Weighing follows.', '₹{msp} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਤੇ ਸਰਕਾਰੀ ਏਜੰਸੀ ਨੂੰ ਵੇਚਣ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ। ਫਿਰ ਤੋਲ ਹੋਵੇਗਾ।', '₹{msp} प्रति क्विंटल शासकीय संस्थेला विक्रीची पुष्टी करा. नंतर वजन होईल.'),
  td_yesMsp: r('हाँ, MSP पर बेचें', 'Yes, sell at MSP', 'ਹਾਂ, MSP ਤੇ ਵੇਚੋ', 'होय, MSP ला विका'),
  td_priceFail: r('भाव तय नहीं हुआ।', 'Could not fix price.', 'ਭਾਅ ਤੈਅ ਨਹੀਂ ਹੋਇਆ।', 'भाव ठरला नाही.'),
  td_auctionTitle: r('व्यापारी नीलामी (e-Auction)', 'Trader auction (e-Auction)', 'ਵਪਾਰੀ ਨੀਲਾਮੀ (e-Auction)', 'व्यापारी लिलाव (e-Auction)'),
  td_auctionSub: r('10 मिनट लाइव बोली • न्यूनतम भाव MSP ₹{msp}', '10-minute live bidding • floor price MSP ₹{msp}', '10 ਮਿੰਟ ਲਾਈਵ ਬੋਲੀ • ਘੱਟੋ-ਘੱਟ MSP ₹{msp}', '10 मिनिटे लाइव्ह बोली • किमान भाव MSP ₹{msp}'),
  td_prevRejected: r('पिछली नीलामी अस्वीकार की गई', 'Previous auction was rejected', 'ਪਿਛਲੀ ਨੀਲਾਮੀ ਅਸਵੀਕਾਰ ਕੀਤੀ', 'मागील लिलाव नाकारला'),
  td_startAuction: r('नीलामी शुरू', 'Start auction', 'ਨੀਲਾਮੀ ਸ਼ੁਰੂ', 'लिलाव सुरू'),
  td_reAuction: r('दोबारा नीलामी', 'Re-auction', 'ਦੁਬਾਰਾ ਨੀਲਾਮੀ', 'पुन्हा लिलाव'),
  td_startConfirm: r('नीलामी शुरू करें?', 'Start the auction?', 'ਨੀਲਾਮੀ ਸ਼ੁਰੂ ਕਰੀਏ?', 'लिलाव सुरू करायचा?'),
  td_startConfirmSub: r('10 मिनट की लाइव बोली शुरू होगी। न्यूनतम भाव MSP ₹{msp} रहेगा। बाद में आप बोली स्वीकार या अस्वीकार कर सकते हैं।', 'A 10-minute live auction will start. Floor price is MSP ₹{msp}. You can accept or reject bids afterwards.', '10 ਮਿੰਟ ਦੀ ਲਾਈਵ ਬੋਲੀ ਸ਼ੁਰੂ ਹੋਵੇਗੀ। ਘੱਟੋ-ਘੱਟ ਭਾਅ MSP ₹{msp}। ਬਾਅਦ ਵਿੱਚ ਬੋਲੀ ਸਵੀਕਾਰ ਜਾਂ ਅਸਵੀਕਾਰ ਕਰ ਸਕਦੇ ਹੋ।', '10 मिनिटांची लाइव्ह बोली सुरू होईल. किमान भाव MSP ₹{msp}. नंतर बोली स्वीकारू किंवा नाकारू शकता.'),
  td_yesStart: r('हाँ, शुरू करें', 'Yes, start', 'ਹਾਂ, ਸ਼ੁਰੂ ਕਰੋ', 'होय, सुरू करा'),
  td_startFail: r('नीलामी शुरू नहीं हुई।', 'Could not start auction.', 'ਨੀਲਾਮੀ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋਈ।', 'लिलाव सुरू झाला नाही.'),
  td_live: r('🔴 नीलामी चालू', '🔴 Auction live', '🔴 ਨੀਲਾਮੀ ਚਾਲੂ', '🔴 लिलाव सुरू'),
  td_ended: r('⏹ नीलामी समाप्त', '⏹ Auction ended', '⏹ ਨੀਲਾਮੀ ਖ਼ਤਮ', '⏹ लिलाव संपला'),
  td_highest: r('सबसे ऊँची बोली: {who} • कुल {n} बोलियाँ', 'Highest bid: {who} • {n} bids', 'ਸਭ ਤੋਂ ਉੱਚੀ ਬੋਲੀ: {who} • ਕੁੱਲ {n} ਬੋਲੀਆਂ', 'सर्वाधिक बोली: {who} • एकूण {n} बोली'),
  td_aboveMsp: r('MSP से ₹{d} अधिक', '₹{d} above MSP', 'MSP ਤੋਂ ₹{d} ਵੱਧ', 'MSP पेक्षा ₹{d} जास्त'),
  td_noBids: r('अभी तक कोई बोली नहीं आई', 'No bids yet', 'ਅਜੇ ਕੋਈ ਬੋਲੀ ਨਹੀਂ', 'अजून बोली नाही'),
  td_acceptBid: r('बोली स्वीकार करें', 'Accept bid', 'ਬੋਲੀ ਸਵੀਕਾਰ ਕਰੋ', 'बोली स्वीकारा'),
  td_acceptConfirm: r('बोली स्वीकार करें?', 'Accept this bid?', 'ਬੋਲੀ ਸਵੀਕਾਰ ਕਰੀਏ?', 'बोली स्वीकारायची?'),
  td_acceptConfirmSub: r('{who} — ₹{amt} / क्विंटल। इसके बाद तौल होगा।', '{who} — ₹{amt} / qtl. Weighing follows.', '{who} — ₹{amt} / ਕੁਇੰਟਲ। ਫਿਰ ਤੋਲ ਹੋਵੇਗਾ।', '{who} — ₹{amt} / क्विंटल. नंतर वजन होईल.'),
  td_accept: r('स्वीकार', 'Accept', 'ਸਵੀਕਾਰ', 'स्वीकारा'),
  td_acceptFail: r('स्वीकार नहीं हुआ।', 'Could not accept.', 'ਸਵੀਕਾਰ ਨਹੀਂ ਹੋਇਆ।', 'स्वीकारता आले नाही.'),
  td_more5: r('5 मिनट और', '5 more min', '5 ਮਿੰਟ ਹੋਰ', 'आणखी 5 मिनिटे'),
  td_reject: r('अस्वीकार', 'Reject', 'ਅਸਵੀਕਾਰ', 'नाकारा'),
  td_rejectConfirm: r('बोली अस्वीकार?', 'Reject bids?', 'ਬੋਲੀ ਅਸਵੀਕਾਰ?', 'बोली नाकारायची?'),
  td_rejectConfirmSub: r('आप फिर MSP पर बेच सकते हैं या दोबारा नीलामी कर सकते हैं।', 'You can then sell at MSP or re-auction.', 'ਫਿਰ ਤੁਸੀਂ MSP ਤੇ ਵੇਚ ਸਕਦੇ ਹੋ ਜਾਂ ਦੁਬਾਰਾ ਨੀਲਾਮੀ ਕਰ ਸਕਦੇ ਹੋ।', 'नंतर तुम्ही MSP ला विकू शकता किंवा पुन्हा लिलाव करू शकता.'),
  td_failed: r('असफल।', 'Failed.', 'ਅਸਫਲ।', 'अयशस्वी.'),
  td_fixedPrice: r('तय भाव', 'Fixed price', 'ਤੈਅ ਭਾਅ', 'निश्चित भाव'),
  td_mode: r('माध्यम', 'Mode', 'ਮਾਧਿਅਮ', 'माध्यम'),
  td_auction: r('नीलामी', 'Auction', 'ਨੀਲਾਮੀ', 'लिलाव'),
  td_buyer: r('खरीदार', 'Buyer', 'ਖਰੀਦਦਾਰ', 'खरेदीदार'),
  td_govBuyer: r('सरकारी खरीद एजेंसी (MSP)', 'Government agency (MSP)', 'ਸਰਕਾਰੀ ਖਰੀਦ ਏਜੰਸੀ (MSP)', 'शासकीय खरेदी संस्था (MSP)'),
  td_weighing: r('तौल', 'Weighing', 'ਤੋਲ', 'वजन'),
  td_gross: r('कुल वजन', 'Gross weight', 'ਕੁੱਲ ਵਜ਼ਨ', 'एकूण वजन'),
  td_tare: r('खाली वाहन', 'Empty vehicle', 'ਖਾਲੀ ਵਾਹਨ', 'रिकामे वाहन'),
  td_net: r('शुद्ध वजन', 'Net weight', 'ਸ਼ੁੱਧ ਵਜ਼ਨ', 'निव्वळ वजन'),
  td_receipt: r('भुगतान रसीद', 'Payment receipt', 'ਭੁਗਤਾਨ ਰਸੀਦ', 'पेमेंट पावती'),
  td_receiptNo: r('रसीद क्रमांक', 'Receipt no.', 'ਰਸੀਦ ਨੰਬਰ', 'पावती क्रमांक'),
  td_total: r('कुल राशि', 'Gross amount', 'ਕੁੱਲ ਰਕਮ', 'एकूण रक्कम'),
  td_mandiFee: r('मंडी शुल्क', 'Mandi fee', 'ਮੰਡੀ ਫੀਸ', 'मंडी शुल्क'),
  td_commission: r('आढ़त', 'Commission', 'ਆੜ੍ਹਤ', 'अडत'),
  td_hamali: r('हमाली', 'Hamali (labour)', 'ਹਮਾਲੀ', 'हमाली'),
  td_netPay: r('नेट भुगतान', 'Net payment', 'ਨੈੱਟ ਭੁਗਤਾਨ', 'निव्वळ पेमेंट'),
  td_ref: r('संदर्भ संख्या: {ref}', 'Reference: {ref}', 'ਸੰਦਰਭ ਨੰਬਰ: {ref}', 'संदर्भ क्रमांक: {ref}'),
  td_downloadReceipt: r('⬇  रसीद PDF डाउनलोड करें', '⬇  Download receipt PDF', '⬇  ਰਸੀਦ PDF ਡਾਊਨਲੋਡ ਕਰੋ', '⬇  पावती PDF डाउनलोड करा'),
  td_cancelBooking: r('बुकिंग रद्द करें', 'Cancel booking', 'ਬੁਕਿੰਗ ਰੱਦ ਕਰੋ', 'बुकिंग रद्द करा'),
  td_cancelConfirm: r('बुकिंग रद्द करें?', 'Cancel this booking?', 'ਬੁਕਿੰਗ ਰੱਦ ਕਰੀਏ?', 'बुकिंग रद्द करायची?'),
  td_cancelConfirmSub: r('यह टोकन रद्द हो जाएगा।', 'This token will be cancelled.', 'ਇਹ ਟੋਕਨ ਰੱਦ ਹੋ ਜਾਵੇਗਾ।', 'हे टोकन रद्द होईल.'),
  td_yesCancel: r('हाँ, रद्द करें', 'Yes, cancel', 'ਹਾਂ, ਰੱਦ ਕਰੋ', 'होय, रद्द करा'),
  td_cancelFail: r('रद्द नहीं हो सका।', 'Could not cancel.', 'ਰੱਦ ਨਹੀਂ ਹੋ ਸਕਿਆ।', 'रद्द करता आले नाही.'),

  /* ------------------------------------------------------------ */
  /* History / payments                                            */
  /* ------------------------------------------------------------ */
  hist_sub: r('आपकी सभी मंडी बुकिंग', 'All your mandi bookings', 'ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਬੁਕਿੰਗਾਂ', 'तुमच्या सर्व मंडी बुकिंग'),
  hist_empty: r('अभी कोई बुकिंग नहीं है।', 'No bookings yet.', 'ਅਜੇ ਕੋਈ ਬੁਕਿੰਗ ਨਹੀਂ।', 'अजून बुकिंग नाही.'),
  hist_emptySub: r('आपकी नई बुकिंग यहां दिखाई देगी।', 'Your new bookings will appear here.', 'ਤੁਹਾਡੀ ਨਵੀਂ ਬੁਕਿੰਗ ਇੱਥੇ ਦਿਖੇਗੀ।', 'तुमची नवीन बुकिंग येथे दिसेल.'),
  hist_view: r('विवरण देखें →', 'View details →', 'ਵੇਰਵਾ ਵੇਖੋ →', 'तपशील पहा →'),
  pay_title: r('भुगतान रसीदें', 'Payment receipts', 'ਭੁਗਤਾਨ ਰਸੀਦਾਂ', 'पेमेंट पावत्या'),
  pay_sub: r('बैंक/ऋण के लिए आधिकारिक रसीद', 'Official receipts for bank / loans', 'ਬੈਂਕ/ਕਰਜ਼ੇ ਲਈ ਅਧਿਕਾਰਤ ਰਸੀਦ', 'बँक / कर्जासाठी अधिकृत पावती'),
  pay_empty: r('अभी कोई भुगतान नहीं', 'No payments yet', 'ਅਜੇ ਕੋਈ ਭੁਗਤਾਨ ਨਹੀਂ', 'अजून पेमेंट नाही'),
  pay_net: r('नेट: ₹{n}', 'Net: ₹{n}', 'ਨੈੱਟ: ₹{n}', 'निव्वळ: ₹{n}'),

  /* ------------------------------------------------------------ */
  /* Officer dashboard                                             */
  /* ------------------------------------------------------------ */
  od_portal: r('मंडी अधिकारी पोर्टल', 'Mandi Officer Portal', 'ਮੰਡੀ ਅਧਿਕਾਰੀ ਪੋਰਟਲ', 'मंडी अधिकारी पोर्टल'),
  od_officer: r('अधिकारी', 'Officer', 'ਅਧਿਕਾਰੀ', 'अधिकारी'),
  od_noCentre: r('मंडी नहीं चुनी', 'No mandi selected', 'ਮੰਡੀ ਨਹੀਂ ਚੁਣੀ', 'मंडी निवडली नाही'),
  od_setupTitle: r('अपनी मंडी चुनें', 'Choose your mandi', 'ਆਪਣੀ ਮੰਡੀ ਚੁਣੋ', 'तुमची मंडी निवडा'),
  od_setupSub: r('मंडी चुने बिना आपको कोई टोकन नहीं दिखेगा। सेट करने के लिए टैप करें।', 'You will not see any tokens until you choose a mandi. Tap to set.', 'ਮੰਡੀ ਚੁਣੇ ਬਿਨਾਂ ਕੋਈ ਟੋਕਨ ਨਹੀਂ ਦਿਖੇਗਾ। ਸੈੱਟ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ।', 'मंडी निवडल्याशिवाय टोकन दिसणार नाहीत. सेट करण्यासाठी टॅप करा.'),
  od_noWork: r('कोई काम बाकी नहीं', 'Nothing pending', 'ਕੋਈ ਕੰਮ ਬਾਕੀ ਨਹੀਂ', 'काही प्रलंबित नाही'),
  od_pending: r('{n} वाहन आपके पास लंबित', '{n} vehicles pending with you', '{n} ਵਾਹਨ ਤੁਹਾਡੇ ਕੋਲ ਬਾਕੀ', '{n} वाहने तुमच्याकडे प्रलंबित'),
  od_todayLine: r('आज कुल {total} टोकन • अंदर {inside}', 'Today {total} tokens • {inside} inside', 'ਅੱਜ ਕੁੱਲ {total} ਟੋਕਨ • ਅੰਦਰ {inside}', 'आज एकूण {total} टोकन • आत {inside}'),
  od_yourWork: r('आपका काम', 'Your work', 'ਤੁਹਾਡਾ ਕੰਮ', 'तुमचे काम'),
  od_summary: r('आज का सारांश', "Today's summary", 'ਅੱਜ ਦਾ ਸਾਰ', 'आजचा सारांश'),
  od_totalTokens: r('कुल टोकन', 'Total tokens', 'ਕੁੱਲ ਟੋਕਨ', 'एकूण टोकन'),
  od_waiting: r('प्रतीक्षित', 'Waiting', 'ਉਡੀਕ ਵਿੱਚ', 'प्रतीक्षेत'),
  od_inside: r('अंदर', 'Inside', 'ਅੰਦਰ', 'आत'),
  od_paid: r('भुगतान', 'Paid', 'ਭੁਗਤਾਨ', 'पेमेंट'),
  od_absent: r('अनुपस्थित', 'Absent', 'ਗੈਰਹਾਜ਼ਰ', 'गैरहजर'),
  od_other: r('अन्य', 'Other', 'ਹੋਰ', 'इतर'),
  od_fullQueue: r('पूरी कतार देखें', 'View full queue', 'ਪੂਰੀ ਕਤਾਰ ਵੇਖੋ', 'संपूर्ण रांग पहा'),
  od_dailyReport: r('दैनिक रिपोर्ट', 'Daily report', 'ਰੋਜ਼ਾਨਾ ਰਿਪੋਰਟ', 'दैनिक अहवाल'),
  od_delayReport: r('विलंब रिपोर्ट', 'Delay report', 'ਦੇਰੀ ਰਿਪੋਰਟ', 'विलंब अहवाल'),
  od_changePosting: r('मंडी / ड्यूटी / पहचान बदलें', 'Change mandi / duty / ID', 'ਮੰਡੀ / ਡਿਊਟੀ / ਪਛਾਣ ਬਦਲੋ', 'मंडी / कर्तव्य / ओळख बदला'),
  // stage cards (from DUTY_STAGES)
  stg_gate_t: r('गेट प्रवेश', 'Gate entry', 'ਗੇਟ ਐਂਟਰੀ', 'गेट प्रवेश'),
  stg_gate_s: r('वाहन को अंदर भेजें', 'Let vehicles in', 'ਵਾਹਨ ਨੂੰ ਅੰਦਰ ਭੇਜੋ', 'वाहन आत पाठवा'),
  stg_gate_a: r('गेट प्रवेश', 'Gate entry', 'ਗੇਟ ਐਂਟਰੀ', 'गेट प्रवेश'),
  stg_assay_t: r('गुणवत्ता जांच', 'Quality check', 'ਗੁਣਵੱਤਾ ਜਾਂਚ', 'गुणवत्ता तपासणी'),
  stg_assay_s: r('नमूना, नमी, ग्रेड और अन्य पदार्थ', 'Sample, moisture, grade & foreign matter', 'ਨਮੂਨਾ, ਨਮੀ, ਗ੍ਰੇਡ ਅਤੇ ਹੋਰ ਪਦਾਰਥ', 'नमुना, ओलावा, ग्रेड व इतर पदार्थ'),
  stg_assay_a: r('जांच करें', 'Inspect', 'ਜਾਂਚ ਕਰੋ', 'तपासा'),
  stg_weighing_t: r('तौल', 'Weighing', 'ਤੋਲ', 'वजन'),
  stg_weighing_s: r('केवल भाव तय हो चुके वाहन', 'Only vehicles with price fixed', 'ਸਿਰਫ਼ ਭਾਅ ਤੈਅ ਹੋਏ ਵਾਹਨ', 'फक्त भाव ठरलेली वाहने'),
  stg_weighing_a: r('तौल करें', 'Weigh', 'ਤੋਲ ਕਰੋ', 'वजन करा'),
  stg_payment_t: r('भुगतान', 'Payment', 'ਭੁਗਤਾਨ', 'पेमेंट'),
  stg_payment_s: r('कटौती और रसीद', 'Deductions & receipt', 'ਕਟੌਤੀ ਅਤੇ ਰਸੀਦ', 'कपात व पावती'),
  stg_payment_a: r('भुगतान करें', 'Pay', 'ਭੁਗਤਾਨ ਕਰੋ', 'पेमेंट करा'),

  /* ------------------------------------------------------------ */
  /* Stage queue / gate scan                                       */
  /* ------------------------------------------------------------ */
  sq_notFound: r('चरण नहीं मिला', 'Stage not found', 'ਪੜਾਅ ਨਹੀਂ ਮਿਲਿਆ', 'टप्पा सापडला नाही'),
  sq_pendingLine: r('{n} वाहन लंबित • {sub}', '{n} vehicles pending • {sub}', '{n} ਵਾਹਨ ਬਾਕੀ • {sub}', '{n} वाहने प्रलंबित • {sub}'),
  sq_scanBtn: r('गेट पास स्कैन करें / नंबर डालें', 'Scan gate pass / enter number', 'ਗੇਟ ਪਾਸ ਸਕੈਨ ਕਰੋ / ਨੰਬਰ ਪਾਓ', 'गेट पास स्कॅन करा / क्रमांक टाका'),
  sq_clear: r('इस चरण में कोई काम बाकी नहीं', 'Nothing pending at this stage', 'ਇਸ ਪੜਾਅ ਵਿੱਚ ਕੋਈ ਕੰਮ ਬਾਕੀ ਨਹੀਂ', 'या टप्प्यात काही प्रलंबित नाही'),
  sq_next: r('अगला', 'NEXT', 'ਅਗਲਾ', 'पुढील'),
  sq_gatePass: r('गेट पास: {code}', 'Gate pass: {code}', 'ਗੇਟ ਪਾਸ: {code}', 'गेट पास: {code}'),
  sq_gradeLine: r('ग्रेड: {g} • नमी {m}%', 'Grade: {g} • moisture {m}%', 'ਗ੍ਰੇਡ: {g} • ਨਮੀ {m}%', 'ग्रेड: {g} • ओलावा {m}%'),
  sq_priceLine: r('भाव ₹{rate}/क्विं. • {mode}', 'Price ₹{rate}/qtl • {mode}', 'ਭਾਅ ₹{rate}/ਕੁਇੰ. • {mode}', 'भाव ₹{rate}/क्विं. • {mode}'),
  sq_auctionBy: r('नीलामी • {who}', 'Auction • {who}', 'ਨੀਲਾਮੀ • {who}', 'लिलाव • {who}'),
  sq_scanShort: r('गेट पास स्कैन', 'Scan pass', 'ਗੇਟ ਪਾਸ ਸਕੈਨ', 'गेट पास स्कॅन'),
  noShowQ: r('अनुपस्थित?', 'No show?', 'ਗੈਰਹਾਜ਼ਰ?', 'गैरहजर?'),
  noShowSub: r('क्या किसान नहीं आया?', 'Did the farmer not arrive?', 'ਕੀ ਕਿਸਾਨ ਨਹੀਂ ਆਇਆ?', 'शेतकरी आला नाही का?'),
  markNoShow: r('अनुपस्थित', 'No show', 'ਗੈਰਹਾਜ਼ਰ', 'गैरहजर'),

  gs_title: r('गेट पास स्कैन', 'Scan gate pass', 'ਗੇਟ ਪਾਸ ਸਕੈਨ', 'गेट पास स्कॅन'),
  gs_expected: r('प्रतीक्षित टोकन', 'Expected token', 'ਉਮੀਦ ਕੀਤਾ ਟੋਕਨ', 'अपेक्षित टोकन'),
  gs_expectHint: r('किसान का गेट पास स्कैन करें या नंबर टाइप करें — बिना पास प्रवेश नहीं', "Scan the farmer's gate pass or type the number — no entry without a pass", 'ਕਿਸਾਨ ਦਾ ਗੇਟ ਪਾਸ ਸਕੈਨ ਕਰੋ ਜਾਂ ਨੰਬਰ ਟਾਈਪ ਕਰੋ — ਬਿਨਾਂ ਪਾਸ ਐਂਟਰੀ ਨਹੀਂ', 'शेतकऱ्याचा गेट पास स्कॅन करा किंवा क्रमांक टाका — पासशिवाय प्रवेश नाही'),
  gs_noPassHint: r('बिना गेट पास (QR / 6-अंक) के प्रवेश नहीं दिया जा सकता', 'Entry is not possible without a gate pass (QR / 6 digits)', 'ਬਿਨਾਂ ਗੇਟ ਪਾਸ (QR / 6-ਅੰਕ) ਐਂਟਰੀ ਨਹੀਂ', 'गेट पासशिवाय (QR / 6 अंक) प्रवेश नाही'),
  gs_camPerm: r('कैमरा अनुमति चाहिए', 'Camera permission needed', 'ਕੈਮਰਾ ਇਜਾਜ਼ਤ ਚਾਹੀਦੀ ਹੈ', 'कॅमेरा परवानगी हवी'),
  gs_allow: r('अनुमति दें', 'Allow', 'ਇਜਾਜ਼ਤ ਦਿਓ', 'परवानगी द्या'),
  gs_typeNumber: r('या गेट पास नंबर टाइप करें', 'Or type the gate pass number', 'ਜਾਂ ਗੇਟ ਪਾਸ ਨੰਬਰ ਟਾਈਪ ਕਰੋ', 'किंवा गेट पास क्रमांक टाका'),
  gs_placeholder: r('गेट पास के 6 अंक', 'gate pass 6 digits', 'ਗੇਟ ਪਾਸ ਦੇ 6 ਅੰਕ', 'गेट पासचे 6 अंक'),
  gs_waitingCount: r('आज की कतार में {n} वाहन प्रतीक्षा में', '{n} vehicles waiting in today\'s queue', 'ਅੱਜ ਦੀ ਕਤਾਰ ਵਿੱਚ {n} ਵਾਹਨ ਉਡੀਕ ਵਿੱਚ', 'आजच्या रांगेत {n} वाहने प्रतीक्षेत'),
  gs_verified: r('✓ सत्यापित टोकन', '✓ Verified token', '✓ ਪ੍ਰਮਾਣਿਤ ਟੋਕਨ', '✓ सत्यापित टोकन'),
  gs_passOk: r('गेट पास सही है ({how})', 'Gate pass valid ({how})', 'ਗੇਟ ਪਾਸ ਸਹੀ ਹੈ ({how})', 'गेट पास बरोबर ({how})'),
  gs_byQr: r('QR', 'QR', 'QR', 'QR'),
  gs_byNumber: r('नंबर', 'number', 'ਨੰਬਰ', 'क्रमांक'),
  gs_admit: r('प्रवेश दें  →', 'Admit  →', 'ਐਂਟਰੀ ਦਿਓ  →', 'प्रवेश द्या  →'),
  gs_rescan: r('रद्द / दोबारा स्कैन', 'Cancel / scan again', 'ਰੱਦ / ਦੁਬਾਰਾ ਸਕੈਨ', 'रद्द / पुन्हा स्कॅन'),
  gs_notFound: r('गेट पास नहीं मिला', 'Gate pass not found', 'ਗੇਟ ਪਾਸ ਨਹੀਂ ਮਿਲਿਆ', 'गेट पास सापडला नाही'),
  gs_notFoundSub: r('आज की कतार में यह पास नहीं है। नंबर जाँचें या मंडी/तारीख देखें।', 'This pass is not in today\'s queue. Check the number or mandi/date.', 'ਅੱਜ ਦੀ ਕਤਾਰ ਵਿੱਚ ਇਹ ਪਾਸ ਨਹੀਂ। ਨੰਬਰ ਜਾਂ ਮੰਡੀ/ਤਾਰੀਖ ਜਾਂਚੋ।', 'आजच्या रांगेत हा पास नाही. क्रमांक किंवा मंडी/तारीख तपासा.'),
  gs_already: r('पहले से प्रवेश', 'Already inside', 'ਪਹਿਲਾਂ ਹੀ ਅੰਦਰ', 'आधीच आत'),
  gs_alreadySub: r('टोकन {t} पहले ही अंदर है।', 'Token {t} is already inside.', 'ਟੋਕਨ {t} ਪਹਿਲਾਂ ਹੀ ਅੰਦਰ ਹੈ।', 'टोकन {t} आधीच आत आहे.'),
  gs_otherToken: r('दूसरा टोकन', 'Different token', 'ਹੋਰ ਟੋਕਨ', 'दुसरे टोकन'),
  gs_otherTokenSub: r('यह पास {a} का है, आपने {b} चुना था। फिर भी {a} को प्रवेश दें?', 'This pass belongs to {a}, you selected {b}. Admit {a} anyway?', 'ਇਹ ਪਾਸ {a} ਦਾ ਹੈ, ਤੁਸੀਂ {b} ਚੁਣਿਆ ਸੀ। ਫਿਰ ਵੀ {a} ਨੂੰ ਐਂਟਰੀ ਦਿਓ?', 'हा पास {a} चा आहे, तुम्ही {b} निवडले होते. तरीही {a} ला प्रवेश द्यायचा?'),
  gs_enterVehicle: r('कृपया वाहन नंबर दर्ज करें।', 'Please enter the vehicle number.', 'ਕਿਰਪਾ ਕਰਕੇ ਵਾਹਨ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'कृपया वाहन क्रमांक टाका.'),
  gs_admitted: r('प्रवेश दर्ज ✓', 'Entry recorded ✓', 'ਐਂਟਰੀ ਦਰਜ ✓', 'प्रवेश नोंदला ✓'),
  gs_sendToLane: r('➡️ किसान को लेन {lane} भेजें (सबसे खाली)', '➡️ Send farmer to LANE {lane} (least busy)', '➡️ ਕਿਸਾਨ ਨੂੰ ਲੇਨ {lane} ਭੇਜੋ (ਸਭ ਤੋਂ ਖਾਲੀ)', '➡️ शेतकऱ्याला लेन {lane} पाठवा (सर्वात रिकामी)'),
  tts_missing_t: r('{lang} आवाज़ इस फ़ोन पर नहीं है', '{lang} voice not installed on this phone', '{lang} ਆਵਾਜ਼ ਇਸ ਫ਼ੋਨ ਤੇ ਨਹੀਂ ਹੈ', '{lang} आवाज या फोनवर नाही'),
  tts_missing_d: r('अभी अंग्रेज़ी में सुनाया जाएगा। {lang} आवाज़ जोड़ने के लिए फ़ोन की टेक्स्ट-टू-स्पीच सेटिंग खोलें → Google Speech Services → Install voice data।', 'Playing in English for now. To add the {lang} voice open the phone\'s Text-to-speech settings → Google Speech Services → Install voice data.', 'ਹੁਣ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਸੁਣਾਇਆ ਜਾਵੇਗਾ। {lang} ਆਵਾਜ਼ ਜੋੜਨ ਲਈ ਫ਼ੋਨ ਦੀ Text-to-speech ਸੈਟਿੰਗ ਖੋਲ੍ਹੋ → Google Speech Services → Install voice data।', 'सध्या इंग्रजीत ऐकवले जाईल. {lang} आवाज जोडण्यासाठी फोनची Text-to-speech सेटिंग उघडा → Google Speech Services → Install voice data.'),
  tts_openSettings: r('सेटिंग खोलें', 'Open settings', 'ਸੈਟਿੰਗ ਖੋਲ੍ਹੋ', 'सेटिंग उघडा'),
  tts_later: r('बाद में', 'Later', 'ਬਾਅਦ ਵਿੱਚ', 'नंतर'),
  gs_nextScan: r('अगला स्कैन', 'Next scan', 'ਅਗਲਾ ਸਕੈਨ', 'पुढील स्कॅन'),
  gs_entryFail: r('गेट प्रवेश दर्ज नहीं हुआ।', 'Could not record gate entry.', 'ਗੇਟ ਐਂਟਰੀ ਦਰਜ ਨਹੀਂ ਹੋਈ।', 'गेट प्रवेश नोंदला नाही.'),

  /* ------------------------------------------------------------ */
  /* Today's queue                                                 */
  /* ------------------------------------------------------------ */
  gateQueue: r('आज की गेट कतार', "Today's Gate Queue", 'ਅੱਜ ਦੀ ਗੇਟ ਕਤਾਰ', 'आजची गेट रांग'),
  tq_nowInside: r('अभी अंदर', 'Now inside', 'ਹੁਣ ਅੰਦਰ', 'सध्या आत'),
  tq_inQueue: r('कतार में {n}', '{n} in queue', 'ਕਤਾਰ ਵਿੱਚ {n}', 'रांगेत {n}'),
  tq_empty: r('कतार खाली है', 'Queue is empty', 'ਕਤਾਰ ਖਾਲੀ ਹੈ', 'रांग रिकामी आहे'),
  tq_timeLine: r('समय: {slot} • अनुमानित {eta}', 'Slot: {slot} • est. {eta}', 'ਸਮਾਂ: {slot} • ਅਨੁਮਾਨਿਤ {eta}', 'वेळ: {slot} • अंदाजे {eta}'),
  tq_qtyLine: r('अनुमानित मात्रा: {q} क्विंटल', 'Approx. quantity: {q} qtl', 'ਅਨੁਮਾਨਿਤ ਮਾਤਰਾ: {q} ਕੁਇੰਟਲ', 'अंदाजे प्रमाण: {q} क्विंटल'),
  tq_gateEntry: r('गेट प्रवेश', 'Gate entry', 'ਗੇਟ ਐਂਟਰੀ', 'गेट प्रवेश'),
  tq_proceed: r('आगे बढ़ें', 'Proceed', 'ਅੱਗੇ ਵਧੋ', 'पुढे जा'),
  tq_useScan: r('गेट प्रवेश केवल गेट पास स्कैन से होगा। गेट अधिकारी कार्ड से स्कैन खोलें।', 'Gate entry is only via gate pass scan. Open the scanner from the Gate card.', 'ਗੇਟ ਐਂਟਰੀ ਸਿਰਫ਼ ਗੇਟ ਪਾਸ ਸਕੈਨ ਨਾਲ। ਗੇਟ ਕਾਰਡ ਤੋਂ ਸਕੈਨਰ ਖੋਲ੍ਹੋ।', 'गेट प्रवेश फक्त गेट पास स्कॅनने. गेट कार्डमधून स्कॅनर उघडा.'),

  /* ------------------------------------------------------------ */
  /* Assay / weighing / payment screens                            */
  /* ------------------------------------------------------------ */
  as_title: r('गुणवत्ता जांच', 'Quality check', 'ਗੁਣਵੱਤਾ ਜਾਂਚ', 'गुणवत्ता तपासणी'),
  tokenAndName: r('{t} • {n}', '{t} • {n}', '{t} • {n}', '{t} • {n}'),
  as_cropLine: r('फसल: {c}', 'Crop: {c}', 'ਫਸਲ: {c}', 'पीक: {c}'),
  as_vehicleLine: r('वाहन: {v}', 'Vehicle: {v}', 'ਵਾਹਨ: {v}', 'वाहन: {v}'),
  as_moisture: r('नमी % (Moisture)', 'Moisture %', 'ਨਮੀ % (Moisture)', 'ओलावा % (Moisture)'),
  as_moistureHint: r('गेहूँ के लिए सामान्य सीमा 12% तक', 'Normal limit for wheat is up to 12%', 'ਕਣਕ ਲਈ ਆਮ ਸੀਮਾ 12% ਤੱਕ', 'गव्हासाठी सामान्य मर्यादा 12% पर्यंत'),
  as_foreign: r('अन्य पदार्थ % (Foreign Matter)', 'Foreign matter %', 'ਹੋਰ ਪਦਾਰਥ % (Foreign Matter)', 'इतर पदार्थ % (Foreign Matter)'),
  as_notes: r('टिप्पणी (वैकल्पिक)', 'Notes (optional)', 'ਟਿੱਪਣੀ (ਵਿਕਲਪਿਕ)', 'टीप (ऐच्छिक)'),
  as_notesPh: r('कोई विशेष बात', 'Anything notable', 'ਕੋਈ ਖ਼ਾਸ ਗੱਲ', 'काही विशेष'),
  as_range: r('कृपया 0 से 100 के बीच सही मान दर्ज करें।', 'Please enter a value between 0 and 100.', '0 ਤੋਂ 100 ਵਿਚਕਾਰ ਸਹੀ ਮੁੱਲ ਦਰਜ ਕਰੋ।', 'कृपया 0 ते 100 दरम्यान योग्य मूल्य टाका.'),
  as_rejected: r('अस्वीकृत', 'Rejected', 'ਅਸਵੀਕਾਰ', 'नाकारले'),
  as_rejectedSub: r('यह लॉट अस्वीकृत कर दिया गया।', 'This lot has been rejected.', 'ਇਹ ਲਾਟ ਅਸਵੀਕਾਰ ਕਰ ਦਿੱਤਾ ਗਿਆ।', 'हा लॉट नाकारला गेला.'),
  as_recordedSub: r('अब किसान भाव तय करेगा (MSP / नीलामी)।', 'The farmer will now fix the price (MSP / auction).', 'ਹੁਣ ਕਿਸਾਨ ਭਾਅ ਤੈਅ ਕਰੇਗਾ (MSP / ਨੀਲਾਮੀ)।', 'आता शेतकरी भाव ठरवेल (MSP / लिलाव).'),
  as_rejectQ: r('लॉट अस्वीकार करें?', 'Reject this lot?', 'ਲਾਟ ਅਸਵੀਕਾਰ ਕਰੀਏ?', 'लॉट नाकारायचा?'),
  as_rejectQSub: r('किसान को भुगतान नहीं होगा।', 'The farmer will not be paid.', 'ਕਿਸਾਨ ਨੂੰ ਭੁਗਤਾਨ ਨਹੀਂ ਹੋਵੇਗਾ।', 'शेतकऱ्याला पेमेंट होणार नाही.'),
  as_yesReject: r('हाँ, अस्वीकार', 'Yes, reject', 'ਹਾਂ, ਅਸਵੀਕਾਰ', 'होय, नाकारा'),
  as_rejectBtn: r('अस्वीकार करें', 'Reject', 'ਅਸਵੀਕਾਰ ਕਰੋ', 'नाकारा'),
  as_submit: r('जांच पूरी - आगे भेजें', 'Complete check - send forward', 'ਜਾਂਚ ਪੂਰੀ - ਅੱਗੇ ਭੇਜੋ', 'तपासणी पूर्ण - पुढे पाठवा'),

  wg_title: r('तौल (Weighbridge)', 'Weighing (Weighbridge)', 'ਤੋਲ (Weighbridge)', 'वजन (Weighbridge)'),
  wg_declared: r('किसान द्वारा बताई मात्रा: {q} क्विंटल', 'Declared by farmer: {q} qtl', 'ਕਿਸਾਨ ਵੱਲੋਂ ਦੱਸੀ ਮਾਤਰਾ: {q} ਕੁਇੰਟਲ', 'शेतकऱ्याने सांगितलेले प्रमाण: {q} क्विंटल'),
  wg_gradeLine: r('ग्रेड: {g}', 'Grade: {g}', 'ਗ੍ਰੇਡ: {g}', 'ग्रेड: {g}'),
  wg_priceLine: r('भाव: ₹{r}/क्विंटल • {buyer}', 'Price: ₹{r}/qtl • {buyer}', 'ਭਾਅ: ₹{r}/ਕੁਇੰਟਲ • {buyer}', 'भाव: ₹{r}/क्विंटल • {buyer}'),
  wg_gross: r('कुल वजन / भरा वाहन (क्विंटल)', 'Gross weight / loaded vehicle (qtl)', 'ਕੁੱਲ ਵਜ਼ਨ / ਭਰਿਆ ਵਾਹਨ (ਕੁਇੰਟਲ)', 'एकूण वजन / भरलेले वाहन (क्विंटल)'),
  wg_tare: r('खाली वाहन का वजन (क्विंटल)', 'Empty vehicle weight (qtl)', 'ਖਾਲੀ ਵਾਹਨ ਦਾ ਵਜ਼ਨ (ਕੁਇੰਟਲ)', 'रिकाम्या वाहनाचे वजन (क्विंटल)'),
  wg_tareHint: r('यदि केवल फसल तौली गई है तो 0 रखें', 'Keep 0 if only the crop was weighed', 'ਜੇ ਸਿਰਫ਼ ਫਸਲ ਤੋਲੀ ਹੈ ਤਾਂ 0 ਰੱਖੋ', 'फक्त पीक तोलले असल्यास 0 ठेवा'),
  wg_net: r('शुद्ध वजन', 'Net weight', 'ਸ਼ੁੱਧ ਵਜ਼ਨ', 'निव्वळ वजन'),
  wg_variance: r('बताई मात्रा से {v}%', '{v}% vs declared', 'ਦੱਸੀ ਮਾਤਰਾ ਤੋਂ {v}%', 'सांगितलेल्या प्रमाणापेक्षा {v}%'),
  wg_warn: r('चेतावनी: बताई गई मात्रा से 20% से अधिक अंतर है। कृपया दोबारा जांचें।', 'Warning: more than 20% difference from declared quantity. Please re-check.', 'ਚੇਤਾਵਨੀ: ਦੱਸੀ ਮਾਤਰਾ ਤੋਂ 20% ਵੱਧ ਫ਼ਰਕ। ਦੁਬਾਰਾ ਜਾਂਚੋ।', 'इशारा: सांगितलेल्या प्रमाणापेक्षा 20% पेक्षा जास्त फरक. पुन्हा तपासा.'),
  wg_netZero: r('शुद्ध वजन शून्य से अधिक होना चाहिए।', 'Net weight must be more than zero.', 'ਸ਼ੁੱਧ ਵਜ਼ਨ ਸਿਫ਼ਰ ਤੋਂ ਵੱਧ ਹੋਣਾ ਚਾਹੀਦਾ।', 'निव्वळ वजन शून्यापेक्षा जास्त हवे.'),
  wg_recordedSub: r('अब भुगतान की प्रक्रिया करें।', 'Now process the payment.', 'ਹੁਣ ਭੁਗਤਾਨ ਦੀ ਪ੍ਰਕਿਰਿਆ ਕਰੋ।', 'आता पेमेंट प्रक्रिया करा.'),
  wg_submit: r('तौल दर्ज करें', 'Record weight', 'ਤੋਲ ਦਰਜ ਕਰੋ', 'वजन नोंदवा'),
  weight: r('वजन', 'Weight', 'ਵਜ਼ਨ', 'वजन'),

  mp_title: r('भुगतान अंतिम', 'Final payment', 'ਅੰਤਿਮ ਭੁਗਤਾਨ', 'अंतिम पेमेंट'),
  mp_noCentre: r('मंडी की जानकारी नहीं मिली। कटौती 0 मानी जाएगी।', 'Mandi details not found. Deductions will be 0.', 'ਮੰਡੀ ਦੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਮਿਲੀ। ਕਟੌਤੀ 0 ਮੰਨੀ ਜਾਵੇਗੀ।', 'मंडी माहिती सापडली नाही. कपात 0 धरली जाईल.'),
  mp_actualQty: r('वास्तविक तौल (क्विंटल)', 'Actual weight (qtl)', 'ਅਸਲ ਤੋਲ (ਕੁਇੰਟਲ)', 'प्रत्यक्ष वजन (क्विंटल)'),
  mp_rate: r('दर प्रति क्विंटल (₹)', 'Rate per quintal (₹)', 'ਦਰ ਪ੍ਰਤੀ ਕੁਇੰਟਲ (₹)', 'दर प्रति क्विंटल (₹)'),
  mp_rateLocked: r('• तय भाव, बदला नहीं जा सकता', '• fixed price, cannot be changed', '• ਤੈਅ ਭਾਅ, ਬਦਲਿਆ ਨਹੀਂ ਜਾ ਸਕਦਾ', '• निश्चित भाव, बदलता येणार नाही'),
  mp_preview: r('कटौती सहित गणना', 'Calculation with deductions', 'ਕਟੌਤੀ ਸਮੇਤ ਗਣਨਾ', 'कपातीसह गणना'),
  mp_gross: r('कुल राशि: ₹{n}', 'Gross: ₹{n}', 'ਕੁੱਲ ਰਕਮ: ₹{n}', 'एकूण रक्कम: ₹{n}'),
  mp_fee: r('मंडी शुल्क ({p}%): −₹{n}', 'Mandi fee ({p}%): −₹{n}', 'ਮੰਡੀ ਫੀਸ ({p}%): −₹{n}', 'मंडी शुल्क ({p}%): −₹{n}'),
  mp_comm: r('आढ़त ({p}%): −₹{n}', 'Commission ({p}%): −₹{n}', 'ਆੜ੍ਹਤ ({p}%): −₹{n}', 'अडत ({p}%): −₹{n}'),
  mp_hamali: r('हमाली (₹{p}/क्विंटल): −₹{n}', 'Hamali (₹{p}/qtl): −₹{n}', 'ਹਮਾਲੀ (₹{p}/ਕੁਇੰਟਲ): −₹{n}', 'हमाली (₹{p}/क्विंटल): −₹{n}'),
  mp_net: r('नेट देय: ₹{n}', 'Net payable: ₹{n}', 'ਨੈੱਟ ਦੇਣਯੋਗ: ₹{n}', 'निव्वळ देय: ₹{n}'),
  mp_badQty: r('कृपया सही मात्रा दर्ज करें।', 'Please enter a valid quantity.', 'ਸਹੀ ਮਾਤਰਾ ਦਰਜ ਕਰੋ।', 'योग्य प्रमाण टाका.'),
  mp_badRate: r('कृपया सही दर दर्ज करें।', 'Please enter a valid rate.', 'ਸਹੀ ਦਰ ਦਰਜ ਕਰੋ।', 'योग्य दर टाका.'),
  mp_success: r('सफल', 'Success', 'ਸਫਲ', 'यशस्वी'),
  mp_successSub: r('रसीद जनरेट हो गई', 'Receipt generated', 'ਰਸੀਦ ਬਣ ਗਈ', 'पावती तयार झाली'),
  mp_fail: r('भुगतान दर्ज नहीं हुआ।', 'Could not record payment.', 'ਭੁਗਤਾਨ ਦਰਜ ਨਹੀਂ ਹੋਇਆ।', 'पेमेंट नोंदले नाही.'),
  mp_submit: r('आधिकारिक रसीद बनाएं', 'Generate official receipt', 'ਅਧਿਕਾਰਤ ਰਸੀਦ ਬਣਾਓ', 'अधिकृत पावती तयार करा'),

  /* ------------------------------------------------------------ */
  /* Officer profile / reports / delay                             */
  /* ------------------------------------------------------------ */
  profile: r('प्रोफ़ाइल', 'Profile', 'ਪ੍ਰੋਫ਼ਾਈਲ', 'प्रोफाइल'),
  op_title: r('अधिकारी प्रोफ़ाइल', 'Officer profile', 'ਅਧਿਕਾਰੀ ਪ੍ਰੋਫ਼ਾਈਲ', 'अधिकारी प्रोफाइल'),
  op_sub: r('मंडी, ड्यूटी और पहचान', 'Mandi, duty and ID', 'ਮੰਡੀ, ਡਿਊਟੀ ਅਤੇ ਪਛਾਣ', 'मंडी, कर्तव्य व ओळख'),
  op_mustPick: r('काम शुरू करने से पहले अपनी मंडी चुनें।', 'Choose your mandi before starting work.', 'ਕੰਮ ਸ਼ੁਰੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣੀ ਮੰਡੀ ਚੁਣੋ।', 'काम सुरू करण्यापूर्वी तुमची मंडी निवडा.'),
  op_empId: r('कर्मचारी आईडी', 'Employee ID', 'ਕਰਮਚਾਰੀ ID', 'कर्मचारी ID'),
  op_verification: r('सत्यापन', 'Verification', 'ਤਸਦੀਕ', 'पडताळणी'),
  op_verified: r('सत्यापित', 'Verified', 'ਤਸਦੀਕਸ਼ੁਦਾ', 'सत्यापित'),
  op_pending: r('लंबित', 'Pending', 'ਬਾਕੀ', 'प्रलंबित'),
  op_yourMandi: r('आपकी मंडी', 'Your mandi', 'ਤੁਹਾਡੀ ਮੰਡੀ', 'तुमची मंडी'),
  op_yourMandiHelp: r('आपको केवल इसी मंडी के टोकन और काम दिखाई देंगे।', 'You will only see tokens and work from this mandi.', 'ਤੁਹਾਨੂੰ ਸਿਰਫ਼ ਇਸੇ ਮੰਡੀ ਦੇ ਟੋਕਨ ਦਿਖਣਗੇ।', 'तुम्हाला फक्त याच मंडीचे टोकन दिसतील.'),
  op_duty: r('ड्यूटी पद', 'Duty', 'ਡਿਊਟੀ', 'कर्तव्य'),
  op_savePosting: r('मंडी और ड्यूटी सहेजें', 'Save mandi & duty', 'ਮੰਡੀ ਅਤੇ ਡਿਊਟੀ ਸੰਭਾਲੋ', 'मंडी व कर्तव्य जतन करा'),
  op_savedSub: r('आपकी मंडी और ड्यूटी अपडेट हो गई।', 'Your mandi and duty are updated.', 'ਤੁਹਾਡੀ ਮੰਡੀ ਅਤੇ ਡਿਊਟੀ ਅੱਪਡੇਟ ਹੋ ਗਈ।', 'तुमची मंडी व कर्तव्य अद्ययावत झाले.'),
  op_pickMandi: r('मंडी चुनें', 'Choose mandi', 'ਮੰਡੀ ਚੁਣੋ', 'मंडी निवडा'),
  op_pickMandiSub: r('कृपया अपनी मंडी चुनें।', 'Please choose your mandi.', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਮੰਡੀ ਚੁਣੋ।', 'कृपया तुमची मंडी निवडा.'),
  op_idTitle: r('पहचान सत्यापन', 'Identity verification', 'ਪਛਾਣ ਤਸਦੀਕ', 'ओळख पडताळणी'),
  op_idHelp: r('आधार संख्या दर्ज करें। सरकारी सत्यापन बाद में जोड़ा जाएगा।', 'Enter your Aadhaar number. Government verification will be added later.', 'ਆਧਾਰ ਨੰਬਰ ਦਰਜ ਕਰੋ। ਸਰਕਾਰੀ ਤਸਦੀਕ ਬਾਅਦ ਵਿੱਚ ਜੋੜੀ ਜਾਵੇਗੀ।', 'आधार क्रमांक टाका. शासकीय पडताळणी नंतर जोडली जाईल.'),
  op_idPh: r('12 अंकों की आधार संख्या', '12-digit Aadhaar number', '12 ਅੰਕਾਂ ਦਾ ਆਧਾਰ ਨੰਬਰ', '12 अंकी आधार क्रमांक'),
  op_saveId: r('पहचान सहेजें', 'Save ID', 'ਪਛਾਣ ਸੰਭਾਲੋ', 'ओळख जतन करा'),
  op_idSaved: r('पहचान संख्या दर्ज हो गई।', 'ID number saved.', 'ਪਛਾਣ ਨੰਬਰ ਦਰਜ ਹੋ ਗਿਆ।', 'ओळख क्रमांक जतन झाला.'),

  rp_title: r('दैनिक रिपोर्ट', 'Daily report', 'ਰੋਜ਼ਾਨਾ ਰਿਪੋਰਟ', 'दैनिक अहवाल'),
  rp_pickFirst: r('रिपोर्ट देखने के लिए पहले अपनी मंडी चुनें।', 'Choose your mandi first to see the report.', 'ਰਿਪੋਰਟ ਵੇਖਣ ਲਈ ਪਹਿਲਾਂ ਮੰਡੀ ਚੁਣੋ।', 'अहवाल पाहण्यासाठी आधी मंडी निवडा.'),
  rp_tokens: r('टोकन', 'Tokens', 'ਟੋਕਨ', 'टोकन'),
  rp_paidCount: r('भुगतान हुआ', 'Paid', 'ਭੁਗਤਾਨ ਹੋਇਆ', 'पेमेंट झाले'),
  rp_procurement: r('खरीद', 'Procurement', 'ਖਰੀਦ', 'खरेदी'),
  rp_totalProcured: r('कुल खरीद', 'Total procured', 'ਕੁੱਲ ਖਰੀਦ', 'एकूण खरेदी'),
  rp_disbursed: r('वितरित राशि', 'Amount disbursed', 'ਵੰਡੀ ਰਕਮ', 'वितरित रक्कम'),
  rp_nowInside: r('अभी अंदर', 'Now inside', 'ਹੁਣ ਅੰਦਰ', 'सध्या आत'),

  dl_title: r('विलंब रिपोर्ट (एडमिन)', 'Delay report (admin)', 'ਦੇਰੀ ਰਿਪੋਰਟ (ਐਡਮਿਨ)', 'विलंब अहवाल (प्रशासक)'),
  dl_sub: r('सभी शेष ETA अपने आप शिफ्ट होंगे', 'All remaining ETAs shift automatically', 'ਸਾਰੇ ਬਾਕੀ ETA ਆਪਣੇ ਆਪ ਬਦਲ ਜਾਣਗੇ', 'सर्व उर्वरित ETA आपोआप बदलतील'),
  dl_minutes: r('अतिरिक्त मिनट', 'Extra minutes', 'ਵਾਧੂ ਮਿੰਟ', 'अतिरिक्त मिनिटे'),
  dl_reason: r('कारण', 'Reason', 'ਕਾਰਨ', 'कारण'),
  dl_reasonDefault: r('वर्षा / तौल मशीन', 'Rain / weighbridge', 'ਮੀਂਹ / ਤੋਲ ਮਸ਼ੀਨ', 'पाऊस / वजन काटा'),
  dl_submit: r('विलंब प्रसारित करें', 'Broadcast delay', 'ਦੇਰੀ ਪ੍ਰਸਾਰਿਤ ਕਰੋ', 'विलंब प्रसारित करा'),
  dl_doneSub: r('+{m} मिनट विलंब दर्ज', '+{m} min delay recorded', '+{m} ਮਿੰਟ ਦੇਰੀ ਦਰਜ', '+{m} मिनिटे विलंब नोंदला'),
  dl_pickFirst: r('पहले अपनी मंडी चुनें।', 'Choose your mandi first.', 'ਪਹਿਲਾਂ ਆਪਣੀ ਮੰਡੀ ਚੁਣੋ।', 'आधी तुमची मंडी निवडा.'),

  /* ------------------------------------------------------------ */
  /* Trader                                                        */
  /* ------------------------------------------------------------ */
  tr_trader: r('व्यापारी', 'Trader', 'ਵਪਾਰੀ', 'व्यापारी'),
  tr_hello: r('नमस्ते, {n}', 'Hello, {n}', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, {n}', 'नमस्कार, {n}'),
  tr_pickMandi: r('मंडी चुनें', 'Choose mandi', 'ਮੰਡੀ ਚੁਣੋ', 'मंडी निवडा'),
  tr_licenseLine: r('लाइसेंस {l}', 'Licence {l}', 'ਲਾਇਸੈਂਸ {l}', 'परवाना {l}'),
  tr_needMandi: r('नीलामी देखने के लिए पहले अपनी मंडी चुनें →', 'Choose your mandi to see auctions →', 'ਨੀਲਾਮੀ ਵੇਖਣ ਲਈ ਪਹਿਲਾਂ ਮੰਡੀ ਚੁਣੋ →', 'लिलाव पाहण्यासाठी आधी मंडी निवडा →'),
  tr_wonToday: r('🏆 आज {n} लॉट जीते', '🏆 Won {n} lots today', '🏆 ਅੱਜ {n} ਲਾਟ ਜਿੱਤੇ', '🏆 आज {n} लॉट जिंकले'),
  tr_liveAuction: r('लाइव नीलामी', 'Live auction', 'ਲਾਈਵ ਨੀਲਾਮੀ', 'लाइव्ह लिलाव'),
  tr_openLots: r('{n} लॉट पर बोली चालू', 'Bidding open on {n} lots', '{n} ਲਾਟ ਤੇ ਬੋਲੀ ਚਾਲੂ', '{n} लॉटवर बोली सुरू'),
  tr_leading: r(' • {n} में आप आगे', ' • you lead {n}', ' • {n} ਵਿੱਚ ਤੁਸੀਂ ਅੱਗੇ', ' • {n} मध्ये तुम्ही पुढे'),
  tr_noOpen: r('अभी कोई लॉट खुला नहीं', 'No lots open right now', 'ਹੁਣ ਕੋਈ ਲਾਟ ਖੁੱਲ੍ਹਾ ਨਹੀਂ', 'सध्या कोणताही लॉट खुला नाही'),
  tr_totalLots: r('कुल लॉट', 'Total lots', 'ਕੁੱਲ ਲਾਟ', 'एकूण लॉट'),
  tr_bidOpen: r('बोली चालू', 'Bidding open', 'ਬੋਲੀ ਚਾਲੂ', 'बोली सुरू'),
  tr_won: r('जीते', 'Won', 'ਜਿੱਤੇ', 'जिंकले'),
  tr_qtlBought: r('क्विंटल खरीद', 'Quintals bought', 'ਕੁਇੰਟਲ ਖਰੀਦ', 'क्विंटल खरेदी'),
  tr_myPurchases: r('मेरी खरीद', 'My purchases', 'ਮੇਰੀ ਖਰੀਦ', 'माझी खरेदी'),
  tr_mandiProfile: r('मंडी / प्रोफ़ाइल', 'Mandi / profile', 'ਮੰਡੀ / ਪ੍ਰੋਫ਼ਾਈਲ', 'मंडी / प्रोफाइल'),
  tr_profileTitle: r('व्यापारी प्रोफ़ाइल', 'Trader profile', 'ਵਪਾਰੀ ਪ੍ਰੋਫ਼ਾਈਲ', 'व्यापारी प्रोफाइल'),
  tr_firm: r('फर्म', 'Firm', 'ਫਰਮ', 'फर्म'),
  tr_license: r('लाइसेंस', 'Licence', 'ਲਾਇਸੈਂਸ', 'परवाना'),
  tr_tradeMandi: r('व्यापार की मंडी', 'Trading mandi', 'ਵਪਾਰ ਦੀ ਮੰਡੀ', 'व्यापाराची मंडी'),
  tr_mandiSaved: r('आपकी मंडी अपडेट हो गई।', 'Your mandi is updated.', 'ਤੁਹਾਡੀ ਮੰਡੀ ਅੱਪਡੇਟ ਹੋ ਗਈ।', 'तुमची मंडी अद्ययावत झाली.'),

  ab_title: r('नीलामी बोर्ड', 'Auction board', 'ਨੀਲਾਮੀ ਬੋਰਡ', 'लिलाव फलक'),
  ab_sub: r('{c} • {n} लॉट चालू', '{c} • {n} lots live', '{c} • {n} ਲਾਟ ਚਾਲੂ', '{c} • {n} लॉट सुरू'),
  ab_pickFirst: r('पहले प्रोफ़ाइल में मंडी चुनें।', 'Choose a mandi in your profile first.', 'ਪਹਿਲਾਂ ਪ੍ਰੋਫ਼ਾਈਲ ਵਿੱਚ ਮੰਡੀ ਚੁਣੋ।', 'आधी प्रोफाइलमध्ये मंडी निवडा.'),
  ab_empty: r('आज अभी कोई लॉट नीलामी में नहीं आया', 'No lots up for auction yet today', 'ਅੱਜ ਅਜੇ ਕੋਈ ਲਾਟ ਨੀਲਾਮੀ ਵਿੱਚ ਨਹੀਂ', 'आज अजून कोणताही लॉट लिलावात नाही'),
  ab_emptySub: r('गुणवत्ता जांच के बाद किसान लॉट खोलेगा, वह यहाँ तुरंत दिखेगा।', 'After the quality check a farmer opens the lot; it appears here instantly.', 'ਗੁਣਵੱਤਾ ਜਾਂਚ ਬਾਅਦ ਕਿਸਾਨ ਲਾਟ ਖੋਲ੍ਹੇਗਾ, ਇੱਥੇ ਤੁਰੰਤ ਦਿਖੇਗਾ।', 'गुणवत्ता तपासणीनंतर शेतकरी लॉट उघडेल, तो येथे लगेच दिसेल.'),
  ab_live: r('🔴 चालू', '🔴 Live', '🔴 ਚਾਲੂ', '🔴 सुरू'),
  ab_past: r('पुराने / बंद', 'Past / closed', 'ਪੁਰਾਣੇ / ਬੰਦ', 'जुने / बंद'),
  ab_lotLine: r('{crop} • ग्रेड {g} • ~{q} क्विं.', '{crop} • grade {g} • ~{q} qtl', '{crop} • ਗ੍ਰੇਡ {g} • ~{q} ਕੁਇੰ.', '{crop} • ग्रेड {g} • ~{q} क्विं.'),
  ab_metaLine: r('नमी {m}% • अन्य पदार्थ {f}% • MSP ₹{msp}', 'Moisture {m}% • foreign {f}% • MSP ₹{msp}', 'ਨਮੀ {m}% • ਹੋਰ ਪਦਾਰਥ {f}% • MSP ₹{msp}', 'ओलावा {m}% • इतर {f}% • MSP ₹{msp}'),
  ab_highest: r('सबसे ऊँची बोली', 'Highest bid', 'ਸਭ ਤੋਂ ਉੱਚੀ ਬੋਲੀ', 'सर्वाधिक बोली'),
  ab_bids: r('{n} बोलियाँ', '{n} bids', '{n} ਬੋਲੀਆਂ', '{n} बोली'),
  ab_youWon: r('🏆 आपने जीता', '🏆 You won', '🏆 ਤੁਸੀਂ ਜਿੱਤੇ', '🏆 तुम्ही जिंकलात'),
  ab_youLead: r('● आप आगे हैं', '● You are leading', '● ਤੁਸੀਂ ਅੱਗੇ ਹੋ', '● तुम्ही पुढे आहात'),
  ast_open: r('बोली चालू', 'Bidding open', 'ਬੋਲੀ ਚਾਲੂ', 'बोली सुरू'),
  ast_closed: r('समय समाप्त', 'Time over', 'ਸਮਾਂ ਖ਼ਤਮ', 'वेळ संपली'),
  ast_accepted: r('बिक गया', 'Sold', 'ਵਿਕ ਗਿਆ', 'विकले'),
  ast_rejected: r('अस्वीकृत', 'Rejected', 'ਅਸਵੀਕਾਰ', 'नाकारले'),
  ast_cancelled: r('रद्द', 'Cancelled', 'ਰੱਦ', 'रद्द'),

  bd_notFound: r('लॉट नहीं मिला', 'Lot not found', 'ਲਾਟ ਨਹੀਂ ਮਿਲਿਆ', 'लॉट सापडला नाही'),
  bd_lotTitle: r('लॉट {t}', 'Lot {t}', 'ਲਾਟ {t}', 'लॉट {t}'),
  bd_closesIn: r('बोली बंद होने में', 'Bidding closes in', 'ਬੋਲੀ ਬੰਦ ਹੋਣ ਵਿੱਚ', 'बोली बंद होण्यास'),
  bd_sold: r('बिक गया', 'Sold', 'ਵਿਕ ਗਿਆ', 'विकले'),
  bd_closed: r('नीलामी बंद', 'Auction closed', 'ਨੀਲਾਮੀ ਬੰਦ', 'लिलाव बंद'),
  bd_yourHighest: r('● आपकी बोली सबसे ऊँची है', '● Your bid is the highest', '● ਤੁਹਾਡੀ ਬੋਲੀ ਸਭ ਤੋਂ ਉੱਚੀ ਹੈ', '● तुमची बोली सर्वाधिक आहे'),
  bd_needMore: r('{who} • आपको ₹{n} या अधिक लगानी होगी', '{who} • you need ₹{n} or more', '{who} • ਤੁਹਾਨੂੰ ₹{n} ਜਾਂ ਵੱਧ ਲਗਾਉਣੀ ਪਵੇਗੀ', '{who} • तुम्हाला ₹{n} किंवा जास्त लावावी लागेल'),
  bd_noBidsFloor: r('कोई बोली नहीं • शुरुआती भाव MSP ₹{n}', 'No bids • starting price MSP ₹{n}', 'ਕੋਈ ਬੋਲੀ ਨਹੀਂ • ਸ਼ੁਰੂਆਤੀ ਭਾਅ MSP ₹{n}', 'बोली नाही • सुरुवातीचा भाव MSP ₹{n}'),
  bd_lotDetails: r('लॉट विवरण', 'Lot details', 'ਲਾਟ ਵੇਰਵਾ', 'लॉट तपशील'),
  bd_assayNotes: r('जांच टिप्पणी', 'Assay notes', 'ਜਾਂਚ ਟਿੱਪਣੀ', 'तपासणी टीप'),
  bd_placeBid: r('बोली लगाएँ', 'Place a bid', 'ਬੋਲੀ ਲਗਾਓ', 'बोली लावा'),
  bd_minimum: r('न्यूनतम', 'minimum', 'ਘੱਟੋ-ਘੱਟ', 'किमान'),
  bd_orMore: r('₹{n} या अधिक', '₹{n} or more', '₹{n} ਜਾਂ ਵੱਧ', '₹{n} किंवा जास्त'),
  bd_bid: r('बोली', 'Bid', 'ਬੋਲੀ', 'बोली'),
  bd_leadNote: r('आप पहले से आगे हैं। दूसरा व्यापारी ऊपर जाए तो आप फिर लगा सकते हैं।', 'You are already leading. You can bid again if another trader outbids you.', 'ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਅੱਗੇ ਹੋ। ਕੋਈ ਹੋਰ ਉੱਪਰ ਜਾਵੇ ਤਾਂ ਫਿਰ ਲਗਾ ਸਕਦੇ ਹੋ।', 'तुम्ही आधीच पुढे आहात. दुसरा व्यापारी पुढे गेल्यास पुन्हा लावू शकता.'),
  bd_stepNote: r('न्यूनतम बढ़त ₹{s}। बोली लगाने के बाद वापस नहीं ली जा सकती।', 'Minimum increment ₹{s}. Bids cannot be withdrawn.', 'ਘੱਟੋ-ਘੱਟ ਵਾਧਾ ₹{s}। ਬੋਲੀ ਵਾਪਸ ਨਹੀਂ ਲਈ ਜਾ ਸਕਦੀ।', 'किमान वाढ ₹{s}. बोली मागे घेता येणार नाही.'),
  bd_congrats: r('बधाई! आपने ₹{n}/क्विं. पर जीता', 'Congratulations! You won at ₹{n}/qtl', 'ਵਧਾਈਆਂ! ਤੁਸੀਂ ₹{n}/ਕੁਇੰ. ਤੇ ਜਿੱਤੇ', 'अभिनंदन! तुम्ही ₹{n}/क्विं. ला जिंकलात'),
  bd_boughtBy: r('{who} ने ₹{n} पर खरीदा', '{who} bought at ₹{n}', '{who} ਨੇ ₹{n} ਤੇ ਖਰੀਦਿਆ', '{who} ने ₹{n} ला खरेदी केले'),
  bd_farmerRejected: r('किसान ने बोलियाँ अस्वीकार कीं', 'The farmer rejected the bids', 'ਕਿਸਾਨ ਨੇ ਬੋਲੀਆਂ ਅਸਵੀਕਾਰ ਕੀਤੀਆਂ', 'शेतकऱ्याने बोली नाकारल्या'),
  bd_awaitFarmer: r('समय समाप्त — किसान के निर्णय की प्रतीक्षा', 'Time over — awaiting the farmer\'s decision', 'ਸਮਾਂ ਖ਼ਤਮ — ਕਿਸਾਨ ਦੇ ਫ਼ੈਸਲੇ ਦੀ ਉਡੀਕ', 'वेळ संपली — शेतकऱ्याच्या निर्णयाची प्रतीक्षा'),
  bd_history: r('बोली इतिहास', 'Bid history', 'ਬੋਲੀ ਇਤਿਹਾਸ', 'बोली इतिहास'),
  bd_you: r('आप', 'You', 'ਤੁਸੀਂ', 'तुम्ही'),
  bd_amount: r('राशि', 'Amount', 'ਰਕਮ', 'रक्कम'),
  bd_badAmount: r('सही राशि दर्ज करें।', 'Enter a valid amount.', 'ਸਹੀ ਰਕਮ ਦਰਜ ਕਰੋ।', 'योग्य रक्कम टाका.'),
  bd_bidFailed: r('बोली नहीं लगी', 'Bid not placed', 'ਬੋਲੀ ਨਹੀਂ ਲੱਗੀ', 'बोली लागली नाही'),

  mpu_sub: r('{n} लॉट • {q} क्विंटल • ₹{rs}', '{n} lots • {q} qtl • ₹{rs}', '{n} ਲਾਟ • {q} ਕੁਇੰਟਲ • ₹{rs}', '{n} लॉट • {q} क्विंटल • ₹{rs}'),
  mpu_empty: r('अभी कोई खरीद नहीं', 'No purchases yet', 'ਅਜੇ ਕੋਈ ਖਰੀਦ ਨਹੀਂ', 'अजून खरेदी नाही'),
  mpu_cropLine: r('{crop} • ग्रेड {g} • {f}', '{crop} • grade {g} • {f}', '{crop} • ਗ੍ਰੇਡ {g} • {f}', '{crop} • ग्रेड {g} • {f}'),
  mpu_weighed: r('{q} क्विं. (तौला)', '{q} qtl (weighed)', '{q} ਕੁਇੰ. (ਤੋਲਿਆ)', '{q} क्विं. (तोलले)'),
  mpu_approx: r('~{q} क्विं.', '~{q} qtl', '~{q} ਕੁਇੰ.', '~{q} क्विं.'),
  mpu_total: r('कुल', 'Total', 'ਕੁੱਲ', 'एकूण'),
  mpu_weighPending: r('— तौल बाकी', '— weighing pending', '— ਤੋਲ ਬਾਕੀ', '— वजन बाकी'),
  mpu_awaitWeigh: r('⏳ तौल की प्रतीक्षा', '⏳ Awaiting weighing', '⏳ ਤੋਲ ਦੀ ਉਡੀਕ', '⏳ वजनाची प्रतीक्षा'),
  mpu_awaitPay: r('⚖️ तौल हो गया, भुगतान बाकी', '⚖️ Weighed, payment pending', '⚖️ ਤੋਲ ਹੋ ਗਿਆ, ਭੁਗਤਾਨ ਬਾਕੀ', '⚖️ वजन झाले, पेमेंट बाकी'),
  mpu_complete: r('✅ सौदा पूरा', '✅ Deal complete', '✅ ਸੌਦਾ ਪੂਰਾ', '✅ व्यवहार पूर्ण'),

  /* ------------------------------------------------------------ */
  /* Service errors (thrown with .key)                             */
  /* ------------------------------------------------------------ */
  /* ---------- install49: calendar, 48h cancel, late flow, soon state, variance ---------- */
  'err.cancelWindow': r('बुकिंग सिर्फ {h} घंटे पहले तक रद्द हो सकती है। अब नहीं आ पाएं तो समय निकलने पर "नहीं आऊँगा" चुनें।', 'A booking can only be cancelled up to {h} hours before the slot. If you cannot come now, choose "I won\'t come" once the hour passes.', 'ਬੁਕਿੰਗ ਸਿਰਫ਼ {h} ਘੰਟੇ ਪਹਿਲਾਂ ਤੱਕ ਰੱਦ ਹੋ ਸਕਦੀ ਹੈ।', 'बुकिंग फक्त {h} तास आधीपर्यंत रद्द करता येते.'),
  td_cancelClosed: r('रद्द करने का समय निकल गया (सिर्फ {h} घंटे पहले तक)। न आने पर पास अपने-आप छूटा माना जाएगा।', 'Cancellation window closed (allowed only up to {h} h before). If you don\'t come, the pass will count as missed.', 'ਰੱਦ ਕਰਨ ਦਾ ਸਮਾਂ ਲੰਘ ਗਿਆ (ਸਿਰਫ਼ {h} ਘੰਟੇ ਪਹਿਲਾਂ ਤੱਕ)।', 'रद्द करण्याची वेळ संपली (फक्त {h} तास आधीपर्यंत).'),
  td_lateTitle: r('आपका घंटा निकल गया', 'Your hour has passed', 'ਤੁਹਾਡਾ ਘੰਟਾ ਲੰਘ ਗਿਆ', 'तुमचा तास निघून गेला'),
  td_lateSub: r('बताएं क्या करना है — देर हो गई है और आ रहे हैं, या आज नहीं आएंगे?', 'Tell us what to do — are you late but coming, or not coming today?', 'ਦੱਸੋ — ਦੇਰ ਹੋ ਗਈ ਪਰ ਆ ਰਹੇ ਹੋ, ਜਾਂ ਅੱਜ ਨਹੀਂ ਆਓਗੇ?', 'सांगा — उशीर झाला पण येत आहात, की आज येणार नाही?'),
  td_lateYes: r('देर हो गई, मुझे फिर से बुक करें', "I'm late — re-book me", 'ਦੇਰ ਹੋ ਗਈ — ਮੈਨੂੰ ਦੁਬਾਰਾ ਬੁੱਕ ਕਰੋ', 'उशीर झाला — मला पुन्हा बुक करा'),
  td_lateNo: r('आज नहीं आऊँगा', "I won't come today", 'ਅੱਜ ਨਹੀਂ ਆਵਾਂਗਾ', 'आज येणार नाही'),
  td_lateNoConfirm: r('पास बंद हो जाएगा और जगह दूसरे किसान को मिल जाएगी। पक्का?', 'The pass will close and the room goes to another farmer. Sure?', 'ਪਾਸ ਬੰਦ ਹੋ ਜਾਵੇਗਾ। ਪੱਕਾ?', 'पास बंद होईल. नक्की?'),
  td_lateWaiting: r('गेट अधिकारी को सूचना भेज दी', 'Gate officer has been informed', 'ਗੇਟ ਅਧਿਕਾਰੀ ਨੂੰ ਸੂਚਨਾ ਭੇਜ ਦਿੱਤੀ', 'गेट अधिकाऱ्याला कळवले'),
  td_lateWaitingSub: r('गेट पर पहुँचकर अपना नाम बताएं। अधिकारी आज के खाली घंटे में आपको जगह देंगे; आज जगह न हो तो अगली तारीख पूछेंगे।', 'On reaching the gate, give your name. The officer will fit you into a free hour today; if nothing is free today, you will be offered the next available date.', 'ਗੇਟ ਤੇ ਪਹੁੰਚ ਕੇ ਆਪਣਾ ਨਾਮ ਦੱਸੋ।', 'गेटवर पोहोचून नाव सांगा.'),
  td_varianceOver: r('सूचना: आपने {d} क्विंटल बताया था, तौल में {a} क्विंटल निकला ({p}% ज़्यादा)। कोई जुर्माना नहीं — पर अगली बार सही मात्रा बताएं, इससे मंडी की योजना ठीक रहती है और आपको जगह जल्दी मिलती है।', 'Note: you declared {d} quintals, weighing found {a} quintals ({p}% more). No penalty — but please declare the right quantity next time; it keeps the mandi plan accurate and gets you a slot faster.', 'ਸੂਚਨਾ: ਤੁਸੀਂ {d} ਕੁਇੰਟਲ ਦੱਸਿਆ ਸੀ, ਤੋਲ ਵਿੱਚ {a} ਨਿਕਲਿਆ ({p}% ਵੱਧ)। ਕੋਈ ਜੁਰਮਾਨਾ ਨਹੀਂ — ਅਗਲੀ ਵਾਰ ਸਹੀ ਮਾਤਰਾ ਦੱਸੋ।', 'सूचना: तुम्ही {d} क्विंटल सांगितले, वजनात {a} निघाले ({p}% जास्त). दंड नाही — पुढच्या वेळी योग्य प्रमाण सांगा.'),
  td_varianceUnder: r('सूचना: आपने {d} क्विंटल बताया था, तौल में {a} क्विंटल निकला ({p}% कम)। कोई जुर्माना नहीं — पर अगली बार सही मात्रा बताएं, इससे दूसरे किसानों को भी जगह मिलती है।', 'Note: you declared {d} quintals, weighing found {a} quintals ({p}% less). No penalty — but please declare the right quantity next time; it frees room for other farmers.', 'ਸੂਚਨਾ: ਤੁਸੀਂ {d} ਕੁਇੰਟਲ ਦੱਸਿਆ ਸੀ, ਤੋਲ ਵਿੱਚ {a} ਨਿਕਲਿਆ ({p}% ਘੱਟ)। ਅਗਲੀ ਵਾਰ ਸਹੀ ਮਾਤਰਾ ਦੱਸੋ।', 'सूचना: तुम्ही {d} क्विंटल सांगितले, वजनात {a} निघाले ({p}% कमी). पुढच्या वेळी योग्य प्रमाण सांगा.'),
  qv_soon_h: r('तैयार हो जाएं — आपका घंटा जल्द खुलेगा', 'Get ready — your hour opens soon', 'ਤਿਆਰ ਹੋ ਜਾਓ — ਤੁਹਾਡਾ ਘੰਟਾ ਜਲਦੀ ਖੁੱਲ੍ਹੇਗਾ', 'तयार व्हा — तुमचा तास लवकरच सुरू होईल'),
  qv_soon_d: r('{min} मिनट में गेट आपके लिए खुलेगा। गेट के पास पहुँच जाएं, पर लाइन में तभी लगें जब हरा हो।', 'Gate opens for you in {min} min. Reach near the gate, but join the line only when it turns green.', '{min} ਮਿੰਟ ਵਿੱਚ ਗੇਟ ਖੁੱਲ੍ਹੇਗਾ। ਗੇਟ ਨੇੜੇ ਪਹੁੰਚ ਜਾਓ।', '{min} मिनिटांत गेट उघडेल. गेटजवळ पोहोचा.'),
  qv_lateRequested_h: r('देर की सूचना गेट को भेज दी', 'Late notice sent to the gate', 'ਦੇਰੀ ਦੀ ਸੂਚਨਾ ਗੇਟ ਨੂੰ ਭੇਜ ਦਿੱਤੀ', 'उशिराची सूचना गेटला पाठवली'),
  qv_lateRequested_d: r('गेट पर पहुँचकर नाम बताएं — अधिकारी आपको आज के खाली घंटे में जगह देंगे।', 'Give your name at the gate — the officer will fit you into a free hour today.', 'ਗੇਟ ਤੇ ਨਾਮ ਦੱਸੋ — ਅਧਿਕਾਰੀ ਅੱਜ ਦੇ ਖਾਲੀ ਘੰਟੇ ਵਿੱਚ ਜਗ੍ਹਾ ਦੇਣਗੇ।', 'गेटवर नाव सांगा — अधिकारी आजच्या रिकाम्या तासात जागा देतील.'),
  q_chooseBelow: r('नीचे बताएं: देर हो गई या नहीं आएंगे', 'Choose below: running late, or not coming', 'ਹੇਠਾਂ ਦੱਸੋ: ਦੇਰ ਹੋ ਗਈ ਜਾਂ ਨਹੀਂ ਆਓਗੇ', 'खाली सांगा: उशीर झाला की येणार नाही'),
  q_getReady: r('तैयार रहें — थोड़ी देर में हरा होगा', 'Get ready — turns green shortly', 'ਤਿਆਰ ਰਹੋ — ਥੋੜ੍ਹੀ ਦੇਰ ਵਿੱਚ ਹਰਾ ਹੋਵੇਗਾ', 'तयार रहा — थोड्या वेळात हिरवे होईल'),
  sq_blockSoon: r('🟠 अगला घंटा — 15 मिनट में खुलेगा', '🟠 NEXT — opens within 15 min', '🟠 ਅਗਲਾ — 15 ਮਿੰਟ ਵਿੱਚ ਖੁੱਲ੍ਹੇਗਾ', '🟠 पुढचा — 15 मिनिटांत उघडेल'),
  sq_blockLate: r('🔁 देर से आने वाले — "मुझे फिर बुक करें" अनुरोध', '🔁 RE-BOOK REQUESTS — farmer said "I\'m late"', '🔁 ਦੇਰੀ ਵਾਲੇ — "ਮੈਨੂੰ ਦੁਬਾਰਾ ਬੁੱਕ ਕਰੋ" ਬੇਨਤੀਆਂ', '🔁 उशिरा येणारे — "पुन्हा बुक करा" विनंत्या'),
  sq_lateRebookBtn: r('आज में जगह दें (Re-book)', 'Re-book (fit into today)', 'ਦੁਬਾਰਾ ਬੁੱਕ ਕਰੋ (ਅੱਜ)', 'पुन्हा बुक करा (आज)'),
  sq_lateDone: r('नई बुकिंग हो गई', 'Re-booked', 'ਨਵੀਂ ਬੁਕਿੰਗ ਹੋ ਗਈ', 'पुन्हा बुक झाले'),
  sq_lateDoneBody: r('किसान का नया समय: {pass}। किसान के फ़ोन पर सूचना चली गई।', 'Farmer\'s new slot: {pass}. The farmer has been notified.', 'ਕਿਸਾਨ ਦਾ ਨਵਾਂ ਸਮਾਂ: {pass}।', 'शेतकऱ्याची नवीन वेळ: {pass}.'),
  sq_lateNone: r('आगे कोई जगह नहीं', 'No room ahead', 'ਅੱਗੇ ਕੋਈ ਜਗ੍ਹਾ ਨਹੀਂ', 'पुढे जागा नाही'),
  sq_lateNoneBody: r('अगले 7 दिनों में इस फसल के लिए जगह नहीं मिली। किसान को ऐप से बाद में बुक करने को कहें।', 'No room found for this crop in the next 7 days. Ask the farmer to book later from the app.', 'ਅਗਲੇ 7 ਦਿਨਾਂ ਵਿੱਚ ਜਗ੍ਹਾ ਨਹੀਂ ਮਿਲੀ।', 'पुढील 7 दिवसांत जागा मिळाली नाही.'),
  sq_lateNextTitle: r('आज जगह नहीं है', 'No room left today', 'ਅੱਜ ਜਗ੍ਹਾ ਨਹੀਂ', 'आज जागा नाही'),
  sq_lateNextBody: r('आज के बाकी घंटे भरे हैं। अगली खाली तारीख: {date} {hour}। किसान से पूछें — बुक करें या घर जाएँ?', 'The rest of today is full. Next free date: {date} {hour}. Ask the farmer — book it, or go home?', 'ਅੱਜ ਦੇ ਬਾਕੀ ਘੰਟੇ ਭਰੇ ਹਨ। ਅਗਲੀ ਖਾਲੀ ਤਾਰੀਖ: {date} {hour}।', 'आजचे उरलेले तास भरले आहेत. पुढील रिकामी तारीख: {date} {hour}.'),
  sq_lateBookIt: r('हाँ, बुक करें', 'Yes, book it', 'ਹਾਂ, ਬੁੱਕ ਕਰੋ', 'होय, बुक करा'),
  sq_lateGoHome: r('नहीं, घर जाएँगे', 'No, going home', 'ਨਹੀਂ, ਘਰ ਜਾਵਾਂਗੇ', 'नाही, घरी जाणार'),
  nt_off_lateReq_t: r('देर से आने का अनुरोध', 'Late arrival request', 'ਦੇਰੀ ਦੀ ਬੇਨਤੀ', 'उशिरा येण्याची विनंती'),
  nt_off_lateReq_b: r('{name} ({crop}, {q} क्विंटल) का घंटा निकल गया — कह रहे हैं देर हो गई, आ रहे हैं। गेट सूची में "Re-book" बॉक्स देखें।', '{name} ({crop}, {q} q) missed the hour and says they are late but coming. See the "Re-book" box in the gate list.', '{name} ({crop}, {q} ਕੁਇੰਟਲ) ਦਾ ਘੰਟਾ ਲੰਘ ਗਿਆ — ਆ ਰਹੇ ਹਨ। ਗੇਟ ਸੂਚੀ ਵਿੱਚ "Re-book" ਬਾਕਸ ਵੇਖੋ।', '{name} ({crop}, {q} क्विं) चा तास गेला — येत आहेत. गेट यादीत "Re-book" बॉक्स पहा.'),
  nt_overDeclared_t: r('तौल में मात्रा ज़्यादा निकली', 'Weighed more than declared', 'ਤੋਲ ਵਿੱਚ ਮਾਤਰਾ ਵੱਧ ਨਿਕਲੀ', 'वजनात प्रमाण जास्त निघाले'),
  nt_overDeclared_b: r('आपने {d} क्विंटल बताया था, तौल {a} क्विंटल ({p}% ज़्यादा)। कोई जुर्माना नहीं — कृपया अगली बार सही मात्रा बताएं ताकि सबको समय पर जगह मिले।', 'You declared {d} q, weighing found {a} q ({p}% more). No penalty — please declare accurately next time so everyone gets room on time.', 'ਤੁਸੀਂ {d} ਕੁਇੰਟਲ ਦੱਸਿਆ, ਤੋਲ {a} ({p}% ਵੱਧ)। ਕੋਈ ਜੁਰਮਾਨਾ ਨਹੀਂ — ਅਗਲੀ ਵਾਰ ਸਹੀ ਦੱਸੋ।', 'तुम्ही {d} क्विं सांगितले, वजन {a} ({p}% जास्त). दंड नाही — पुढच्या वेळी योग्य सांगा.'),
  nt_underDeclared_t: r('तौल में मात्रा कम निकली', 'Weighed less than declared', 'ਤੋਲ ਵਿੱਚ ਮਾਤਰਾ ਘੱਟ ਨਿਕਲੀ', 'वजनात प्रमाण कमी निघाले'),
  nt_underDeclared_b: r('आपने {d} क्विंटल बताया था, तौल {a} क्विंटल ({p}% कम)। कोई जुर्माना नहीं — सही मात्रा बताने से दूसरे किसानों को भी जगह मिलती है।', 'You declared {d} q, weighing found {a} q ({p}% less). No penalty — accurate declaration frees room for other farmers.', 'ਤੁਸੀਂ {d} ਕੁਇੰਟਲ ਦੱਸਿਆ, ਤੋਲ {a} ({p}% ਘੱਟ)। ਕੋਈ ਜੁਰਮਾਨਾ ਨਹੀਂ।', 'तुम्ही {d} क्विं सांगितले, वजन {a} ({p}% कमी). दंड नाही.'),
  en_typeHint: r('संख्या टाइप करें या +/− दबाएं', 'type a number or use +/−', 'ਨੰਬਰ ਟਾਈਪ ਕਰੋ ਜਾਂ +/−', 'संख्या टाइप करा किंवा +/−'),
  hb_openHint: r('आज के हर घंटे का पूरा हिसाब — अलग स्क्रीन पर खोलें', 'Full hour-by-hour account of today — opens on its own screen', 'ਅੱਜ ਦੇ ਹਰ ਘੰਟੇ ਦਾ ਹਿਸਾਬ — ਵੱਖਰੀ ਸਕ੍ਰੀਨ', 'आजच्या प्रत्येक तासाचा हिशोब — वेगळ्या स्क्रीनवर'),
  qs_typeHint: r('संख्या टाइप करें या +/− दबाएं', 'Type the number or use +/−', 'ਨੰਬਰ ਟਾਈਪ ਕਰੋ ਜਾਂ +/−', 'संख्या टाइप करा किंवा +/−'),
  sl_pickDate: r('पहले तारीख चुनें', 'First pick a date', 'ਪਹਿਲਾਂ ਤਾਰੀਖ ਚੁਣੋ', 'आधी तारीख निवडा'),
  sl_thenHour: r('अब नीचे से घंटा चुनें', 'Now choose an hour below', 'ਹੁਣ ਹੇਠਾਂ ਤੋਂ ਘੰਟਾ ਚੁਣੋ', 'आता खालून तास निवडा'),
  en_busyDays: r('{n} व्यस्त दिन', '{n} busy days', '{n} ਵਿਅਸਤ ਦਿਨ', '{n} व्यस्त दिवस'),
  en_learnedLegend: r('नीला = इस घंटे की सीखी हुई क्षमता (उन दिनों से जब घंटा भरा था और तौल अगले घंटे तक चली)। ग्रे * = अभी सबूत नहीं, आपका सेट किया नंबर ही चलेगा।', 'Blue = learned capacity for that hour (from days the hour was full and weighing ran into the next hour). Grey * = no proof yet, your set number is used.', 'ਨੀਲਾ = ਸਿੱਖੀ ਸਮਰੱਥਾ। ਗਰੇ * = ਅਜੇ ਸਬੂਤ ਨਹੀਂ, ਤੁਹਾਡਾ ਸੈੱਟ ਨੰਬਰ ਚੱਲੇਗਾ।', 'निळा = शिकलेली क्षमता. राखाडी * = अजून पुरावा नाही, तुमचा सेट नंबर वापरला जाईल.'),
  'err.generic': r('कुछ गलत हो गया।', 'Something went wrong.', 'ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ।', 'काहीतरी चूक झाली.'),
  'err.slotNotOpen': r('इस पास का समय अभी शुरू नहीं हुआ। किसान को अपने घंटे पर आने को कहें।', 'This pass\'s hour has not started. Ask the farmer to come at his hour.', 'ਇਸ ਪਾਸ ਦਾ ਸਮਾਂ ਅਜੇ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋਇਆ।', 'या पासची वेळ अजून सुरू झाली नाही.'),
  'err.slotPassed': r('इस पास का समय निकल चुका है। किसान को गेट पर नई बुकिंग दें।', 'This pass\'s hour has passed. Re-book the farmer at the gate.', 'ਇਸ ਪਾਸ ਦਾ ਸਮਾਂ ਲੰਘ ਚੁੱਕਾ ਹੈ। ਗੇਟ ਤੇ ਨਵੀਂ ਬੁਕਿੰਗ ਦਿਓ।', 'या पासची वेळ निघून गेली. गेटवर नवीन बुकिंग द्या.'),
  'err.badPlate': r('वाहन नंबर सही नहीं है। उदाहरण: HR26AB1234', 'Vehicle plate is not valid. Example: HR26AB1234', 'ਵਾਹਨ ਨੰਬਰ ਸਹੀ ਨਹੀਂ। ਉਦਾਹਰਣ: HR26AB1234', 'वाहन क्रमांक योग्य नाही. उदा: HR26AB1234'),
  'err.dupPlate': r('एक ही वाहन नंबर दो बार दर्ज है।', 'The same plate is entered twice.', 'ਇੱਕੋ ਨੰਬਰ ਦੋ ਵਾਰ ਦਰਜ ਹੈ।', 'एकच क्रमांक दोनदा टाकला आहे.'),
  'err.plateInside': r('वाहन {plate} पहले से मंडी के अंदर किसी और टोकन पर है।', 'Vehicle {plate} is already inside the mandi on another token.', 'ਵਾਹਨ {plate} ਪਹਿਲਾਂ ਹੀ ਮੰਡੀ ਅੰਦਰ ਹੋਰ ਟੋਕਨ ਤੇ ਹੈ।', 'वाहन {plate} आधीच दुसऱ्या टोकनवर मंडीत आहे.'),
  'err.maxTokens': r('इस मंडी में आपके पहले से 2 टोकन चालू हैं। नया लेने से पहले एक पूरा करें या रद्द करें।', 'You already hold 2 active tokens at this mandi. Finish or cancel one first.', 'ਇਸ ਮੰਡੀ ਵਿੱਚ ਤੁਹਾਡੇ ਪਹਿਲਾਂ ਹੀ 2 ਟੋਕਨ ਚਾਲੂ ਹਨ। ਪਹਿਲਾਂ ਇੱਕ ਪੂਰਾ ਜਾਂ ਰੱਦ ਕਰੋ।', 'या मंडीत तुमचे आधीच 2 टोकन सुरू आहेत. आधी एक पूर्ण किंवा रद्द करा.'),
  'err.tooBig': r('इतनी मात्रा एक दिन में इस मंडी में नहीं हो सकती।', 'This quantity is more than the mandi can take in one day.', 'ਇੰਨੀ ਮਾਤਰਾ ਇੱਕ ਦਿਨ ਵਿੱਚ ਇਸ ਮੰਡੀ ਵਿੱਚ ਨਹੀਂ ਹੋ ਸਕਦੀ।', 'एवढे प्रमाण या मंडीत एका दिवसात होऊ शकत नाही.'),
  'err.slotClosed': r('मंडी ने इस घंटे की बुकिंग बंद कर दी है। दूसरा घंटा चुनें।', 'The mandi has closed bookings for this hour. Please choose another hour.', 'ਮੰਡੀ ਨੇ ਇਸ ਘੰਟੇ ਦੀ ਬੁਕਿੰਗ ਬੰਦ ਕੀਤੀ ਹੈ। ਹੋਰ ਘੰਟਾ ਚੁਣੋ।', 'मंडीने या तासाची बुकिंग बंद केली आहे. दुसरा तास निवडा.'),
  'err.horizon': r('इस फसल की बुकिंग इतने दिन पहले नहीं हो सकती। नज़दीकी तारीख चुनें।', 'This crop cannot be booked that far ahead. Pick a nearer date.', 'ਇਸ ਫਸਲ ਦੀ ਬੁਕਿੰਗ ਇੰਨੇ ਦਿਨ ਪਹਿਲਾਂ ਨਹੀਂ ਹੋ ਸਕਦੀ।', 'या पिकाची बुकिंग इतक्या आधी होऊ शकत नाही.'),
  'err.slotFull': r('इस घंटे में अब आपकी मात्रा के लिए जगह नहीं बची। दूसरा घंटा चुनें।', 'This hour no longer has room for your quantity. Please choose another hour.', 'ਇਸ ਘੰਟੇ ਵਿੱਚ ਹੁਣ ਤੁਹਾਡੀ ਮਾਤਰਾ ਲਈ ਥਾਂ ਨਹੀਂ। ਹੋਰ ਘੰਟਾ ਚੁਣੋ।', 'या तासाला आता तुमच्या प्रमाणासाठी जागा नाही. दुसरा तास निवडा.'),
  'err.priceAfterAssay': r('भाव तभी तय हो सकता है जब गुणवत्ता जांच पूरी हो चुकी हो।', 'Price can only be fixed after the quality check.', 'ਭਾਅ ਤਾਂ ਹੀ ਤੈਅ ਹੋ ਸਕਦਾ ਹੈ ਜਦੋਂ ਜਾਂਚ ਪੂਰੀ ਹੋਵੇ।', 'गुणवत्ता तपासणी पूर्ण झाल्यावरच भाव ठरू शकतो.'),
  'err.weighBeforePrice': r('भाव तय होने से पहले तौल नहीं हो सकता।', 'Weighing is not allowed before the price is fixed.', 'ਭਾਅ ਤੈਅ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਤੋਲ ਨਹੀਂ ਹੋ ਸਕਦਾ।', 'भाव ठरण्यापूर्वी वजन होऊ शकत नाही.'),
  'err.lotGone': r('यह लॉट अब उपलब्ध नहीं है।', 'This lot is no longer available.', 'ਇਹ ਲਾਟ ਹੁਣ ਉਪਲਬਧ ਨਹੀਂ।', 'हा लॉट आता उपलब्ध नाही.'),
  'err.auctionClosed': r('यह नीलामी बंद हो चुकी है।', 'This auction is closed.', 'ਇਹ ਨੀਲਾਮੀ ਬੰਦ ਹੋ ਚੁੱਕੀ ਹੈ।', 'हा लिलाव बंद झाला आहे.'),
  'err.timeOver': r('समय समाप्त — बोली स्वीकार नहीं।', 'Time is over — bid not accepted.', 'ਸਮਾਂ ਖ਼ਤਮ — ਬੋਲੀ ਸਵੀਕਾਰ ਨਹੀਂ।', 'वेळ संपली — बोली स्वीकारली नाही.'),
  'err.belowMsp': r('बोली MSP ₹{n} से कम नहीं हो सकती।', 'Bid cannot be below MSP ₹{n}.', 'ਬੋਲੀ MSP ₹{n} ਤੋਂ ਘੱਟ ਨਹੀਂ ਹੋ ਸਕਦੀ।', 'बोली MSP ₹{n} पेक्षा कमी असू शकत नाही.'),
  'err.bidMin': r('बोली कम से कम ₹{n} होनी चाहिए।', 'Bid must be at least ₹{n}.', 'ਬੋਲੀ ਘੱਟੋ-ਘੱਟ ₹{n} ਹੋਣੀ ਚਾਹੀਦੀ।', 'बोली किमान ₹{n} हवी.'),
  'err.alreadyHighest': r('आपकी बोली पहले से सबसे ऊँची है।', 'Your bid is already the highest.', 'ਤੁਹਾਡੀ ਬੋਲੀ ਪਹਿਲਾਂ ਹੀ ਸਭ ਤੋਂ ਉੱਚੀ ਹੈ।', 'तुमची बोली आधीच सर्वाधिक आहे.'),
  'err.notYourLot': r('यह आपका लॉट नहीं है।', 'This is not your lot.', 'ਇਹ ਤੁਹਾਡਾ ਲਾਟ ਨਹੀਂ ਹੈ।', 'हा तुमचा लॉट नाही.'),
  'err.noBids': r('कोई बोली नहीं आई।', 'No bids were received.', 'ਕੋਈ ਬੋਲੀ ਨਹੀਂ ਆਈ।', 'बोली आली नाही.'),
  'err.auctionDecided': r('यह नीलामी पहले ही तय हो चुकी है।', 'This auction has already been decided.', 'ਇਹ ਨੀਲਾਮੀ ਪਹਿਲਾਂ ਹੀ ਤੈਅ ਹੋ ਚੁੱਕੀ ਹੈ।', 'हा लिलाव आधीच ठरला आहे.'),
  'err.cannotReopen': r('यह नीलामी तय हो चुकी है, दोबारा नहीं खुल सकती।', 'This auction is decided and cannot be reopened.', 'ਇਹ ਨੀਲਾਮੀ ਤੈਅ ਹੋ ਚੁੱਕੀ ਹੈ, ਦੁਬਾਰਾ ਨਹੀਂ ਖੁੱਲ੍ਹ ਸਕਦੀ।', 'हा लिलाव ठरला आहे, पुन्हा उघडू शकत नाही.'),
  'err.lotNotFound': r('लॉट नहीं मिला।', 'Lot not found.', 'ਲਾਟ ਨਹੀਂ ਮਿਲਿਆ।', 'लॉट सापडला नाही.'),
  'err.badBid': r('सही बोली राशि दर्ज करें।', 'Enter a valid bid amount.', 'ਸਹੀ ਬੋਲੀ ਰਕਮ ਦਰਜ ਕਰੋ।', 'योग्य बोली रक्कम टाका.'),
  'err.badRate': r('सही दर प्रति क्विंटल आवश्यक है।', 'A valid rate per quintal is required.', 'ਸਹੀ ਦਰ ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਜ਼ਰੂਰੀ ਹੈ।', 'योग्य दर प्रति क्विंटल आवश्यक.'),
  'err.enterName': r('नाम दर्ज करें।', 'Enter your name.', 'ਨਾਮ ਦਰਜ ਕਰੋ।', 'नाव टाका.'),
  'err.badPhone': r('कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।', 'Please enter a valid 10-digit mobile number.', 'ਸਹੀ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'योग्य 10 अंकी मोबाइल क्रमांक टाका.'),
  'err.exists': r('इस मोबाइल नंबर से खाता पहले से मौजूद है। कृपया लॉग इन करें।', 'An account already exists for this number. Please log in.', 'ਇਸ ਨੰਬਰ ਨਾਲ ਖਾਤਾ ਪਹਿਲਾਂ ਹੀ ਹੈ। ਲੌਗਇਨ ਕਰੋ।', 'या क्रमांकाचे खाते आधीच आहे. कृपया लॉगिन करा.'),
  'err.enterEmpId': r('कर्मचारी आईडी दर्ज करें।', 'Enter your employee ID.', 'ਕਰਮਚਾਰੀ ID ਦਰਜ ਕਰੋ।', 'कर्मचारी ID टाका.'),
  'err.pickMandi': r('कृपया अपनी मंडी चुनें।', 'Please choose your mandi.', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਮੰਡੀ ਚੁਣੋ।', 'कृपया तुमची मंडी निवडा.'),
  'err.traderFields': r('लाइसेंस नंबर और फर्म नाम दर्ज करें।', 'Enter licence number and firm name.', 'ਲਾਇਸੈਂਸ ਨੰਬਰ ਅਤੇ ਫਰਮ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ।', 'परवाना क्रमांक व फर्मचे नाव टाका.'),
  'err.traderMandi': r('कृपया वह मंडी चुनें जहाँ आप व्यापार करते हैं।', 'Please choose the mandi where you trade.', 'ਉਹ ਮੰਡੀ ਚੁਣੋ ਜਿੱਥੇ ਤੁਸੀਂ ਵਪਾਰ ਕਰਦੇ ਹੋ।', 'तुम्ही जिथे व्यापार करता ती मंडी निवडा.'),
  'err.notRegistered': r('यह मोबाइल नंबर पंजीकृत नहीं है। कृपया नया खाता बनाएं।', 'This number is not registered. Please create an account.', 'ਇਹ ਨੰਬਰ ਰਜਿਸਟਰਡ ਨਹੀਂ। ਨਵਾਂ ਖਾਤਾ ਬਣਾਓ।', 'हा क्रमांक नोंदणीकृत नाही. नवीन खाते तयार करा.'),
  'err.wrongRole': r('यह खाता {role} के रूप में पंजीकृत है। सही भूमिका चुनें।', 'This account is registered as {role}. Choose the right role.', 'ਇਹ ਖਾਤਾ {role} ਵਜੋਂ ਰਜਿਸਟਰਡ ਹੈ। ਸਹੀ ਭੂਮਿਕਾ ਚੁਣੋ।', 'हे खाते {role} म्हणून नोंदणीकृत आहे. योग्य भूमिका निवडा.'),

  'err.cannotCancel': r('यह बुकिंग अब रद्द नहीं की जा सकती।', 'This booking can no longer be cancelled.', 'ਇਹ ਬੁਕਿੰਗ ਹੁਣ ਰੱਦ ਨਹੀਂ ਹੋ ਸਕਦੀ।', 'ही बुकिंग आता रद्द करता येणार नाही.'),
  'err.mandiNotFound': r('मंडी की जानकारी नहीं मिली।', 'Mandi not found.', 'ਮੰਡੀ ਦੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਮਿਲੀ।', 'मंडी माहिती सापडली नाही.'),
  'err.tokenNotFound': r('टोकन नहीं मिला।', 'Token not found.', 'ਟੋਕਨ ਨਹੀਂ ਮਿਲਿਆ।', 'टोकन सापडले नाही.'),
  'err.aadhaar12': r('आधार संख्या 12 अंकों की होनी चाहिए।', 'Aadhaar number must be 12 digits.', 'ਆਧਾਰ ਨੰਬਰ 12 ਅੰਕਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ।', 'आधार क्रमांक 12 अंकी हवा.'),
  'err.enterId': r('कृपया पहचान संख्या दर्ज करें।', 'Please enter the ID number.', 'ਕਿਰਪਾ ਕਰਕੇ ਪਛਾਣ ਨੰਬਰ ਦਰਜ ਕਰੋ।', 'कृपया ओळख क्रमांक टाका.'),
  // PDF documents
  pdf_receiptTitle: r('भुगतान रसीद / PAYMENT RECEIPT', 'PAYMENT RECEIPT', 'ਭੁਗਤਾਨ ਰਸੀਦ / PAYMENT RECEIPT', 'पेमेंट पावती / PAYMENT RECEIPT'),
  pdf_gatePassTitle: r('गेट पास / GATE PASS', 'GATE PASS', 'ਗੇਟ ਪਾਸ / GATE PASS', 'गेट पास / GATE PASS'),
  pdf_generated: r('यह रसीद AgroBridge द्वारा डिजिटल रूप से बनाई गई है।', 'This receipt was generated digitally by AgroBridge.', 'ਇਹ ਰਸੀਦ AgroBridge ਵੱਲੋਂ ਡਿਜੀਟਲ ਰੂਪ ਵਿੱਚ ਬਣਾਈ ਗਈ ਹੈ।', 'ही पावती AgroBridge ने डिजिटल स्वरूपात तयार केली आहे.'),
  pdf_farmerCopy: r('किसान प्रति', 'Farmer copy', 'ਕਿਸਾਨ ਕਾਪੀ', 'शेतकरी प्रत'),
  pdf_paidOn: r('भुगतान तिथि', 'Paid on', 'ਭੁਗਤਾਨ ਮਿਤੀ', 'पेमेंट दिनांक'),
  pdf_deductions: r('कटौती', 'Deductions', 'ਕਟੌਤੀ', 'कपात'),
  pdf_scanAtGate: r('गेट पर स्कैन करें', 'Scan at the gate', 'ਗੇਟ ਤੇ ਸਕੈਨ ਕਰੋ', 'गेटवर स्कॅन करा'),
  pdf_gatePassNo: r('गेट पास नंबर', 'Gate pass no.', 'ਗੇਟ ਪਾਸ ਨੰਬਰ', 'गेट पास क्रमांक'),
  pdf_slot: r('स्लॉट', 'Slot', 'ਸਲਾਟ', 'स्लॉट'),
  centreLabel_gate: r('गेट पर', 'At the gate', 'ਗੇਟ ਤੇ', 'गेटवर'),

  // ---- install16: phone service (IVR)
  ivr_callMe: r('फ़ोन पर बुक करें', 'Book by phone call', 'ਫ਼ੋਨ ਤੇ ਬੁੱਕ ਕਰੋ', 'फोनवर बुक करा'),
  ivr_callMeSub: r('हम +91 {phone} पर कॉल करेंगे। फ़ोन उठाकर बटन दबाकर स्लॉट बुक करें या टोकन की स्थिति सुनें।', 'We will call +91 {phone}. Answer and press keys to book a slot or hear your token status.', 'ਅਸੀਂ +91 {phone} ਤੇ ਕਾਲ ਕਰਾਂਗੇ। ਫ਼ੋਨ ਚੁੱਕ ਕੇ ਬਟਨ ਦਬਾ ਕੇ ਸਲਾਟ ਬੁੱਕ ਕਰੋ।', 'आम्ही +91 {phone} वर कॉल करू. फोन उचलून बटण दाबून स्लॉट बुक करा.'),
  ivr_callNow: r('कॉल करें', 'Call me', 'ਕਾਲ ਕਰੋ', 'कॉल करा'),
  ivr_calling: r('कॉल आ रही है', 'Calling you', 'ਕਾਲ ਆ ਰਹੀ ਹੈ', 'कॉल येत आहे'),
  ivr_callingSub: r('कुछ सेकंड में आपका फ़ोन बजेगा।', 'Your phone will ring in a few seconds.', 'ਕੁਝ ਸਕਿੰਟਾਂ ਵਿੱਚ ਤੁਹਾਡਾ ਫ਼ੋਨ ਵੱਜੇਗਾ।', 'काही सेकंदांत तुमचा फोन वाजेल.'),
  ivr_callFail: r('अभी कॉल नहीं हो सकी। कृपया थोड़ी देर बाद प्रयास करें।', 'Could not place the call right now. Please try again shortly.', 'ਹੁਣ ਕਾਲ ਨਹੀਂ ਹੋ ਸਕੀ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', 'आत्ता कॉल होऊ शकला नाही. थोड्या वेळाने प्रयत्न करा.'),
  // ---- install15: officer duty lock
  'err.notYourDuty': r('यह काम आपकी ड्यूटी का नहीं है। संबंधित अधिकारी से कहें।', 'This step is not your duty. Ask the officer in charge of it.', 'ਇਹ ਕੰਮ ਤੁਹਾਡੀ ਡਿਊਟੀ ਦਾ ਨਹੀਂ। ਸਬੰਧਤ ਅਧਿਕਾਰੀ ਨੂੰ ਕਹੋ।', 'हे काम तुमच्या कर्तव्यात नाही. संबंधित अधिकाऱ्याला सांगा.'),
  'err.notYourMandi': r('यह टोकन आपकी मंडी का नहीं है।', 'This token belongs to a different mandi.', 'ਇਹ ਟੋਕਨ ਤੁਹਾਡੀ ਮੰਡੀ ਦਾ ਨਹੀਂ।', 'हा टोकन तुमच्या मंडीचा नाही.'),
  'err.badAdminCode': r('मंडी प्रशासक कोड गलत है।', 'Mandi admin code is incorrect.', 'ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ ਕੋਡ ਗਲਤ ਹੈ।', 'मंडी प्रशासक कोड चुकीचा आहे.'),
  reg_adminCode: r('मंडी प्रशासक कोड *', 'Mandi admin code *', 'ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ ਕੋਡ *', 'मंडी प्रशासक कोड *'),
  reg_adminCodeHelp: r('प्रशासक बनने के लिए मंडी सचिव से मिला कोड डालें।', 'Enter the code given by the mandi secretary to register as admin.', 'ਪ੍ਰਸ਼ਾਸਕ ਬਣਨ ਲਈ ਮੰਡੀ ਸਕੱਤਰ ਵੱਲੋਂ ਦਿੱਤਾ ਕੋਡ ਪਾਓ।', 'प्रशासक होण्यासाठी मंडी सचिवांकडून मिळालेला कोड टाका.'),
  op_adminCode: r('मंडी प्रशासक कोड', 'Mandi admin code', 'ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ ਕੋਡ', 'मंडी प्रशासक कोड'),
  op_adminCodeHelp: r('ड्यूटी या मंडी बदलने के लिए प्रशासक कोड ज़रूरी है।', 'Changing duty or mandi requires the admin code.', 'ਡਿਊਟੀ ਜਾਂ ਮੰਡੀ ਬਦਲਣ ਲਈ ਪ੍ਰਸ਼ਾਸਕ ਕੋਡ ਜ਼ਰੂਰੀ ਹੈ।', 'कर्तव्य किंवा मंडी बदलण्यासाठी प्रशासक कोड आवश्यक आहे.'),
  tq_handledBy: r('{who} द्वारा किया जाएगा', 'Handled by {who}', '{who} ਵੱਲੋਂ ਕੀਤਾ ਜਾਵੇਗਾ', '{who} करतील'),
  /* ------------------------------------------------------------ */
  /* Voice guidance                                                */
  /* ------------------------------------------------------------ */

  // ---- Payment basis + arhtiya parchi (install12) ----
  pb_title: r('भुगतान का आधार', 'Payment basis', 'ਭੁਗਤਾਨ ਦਾ ਆਧਾਰ', 'देयकाचा आधार'),
  pb_hint: r('इस रसीद के लिए भाव कैसे तय हुआ था?', 'How was the price for this receipt decided?', 'ਇਸ ਰਸੀਦ ਲਈ ਭਾਅ ਕਿਵੇਂ ਤੈਅ ਹੋਇਆ ਸੀ?', 'या पावतीसाठी भाव कसा ठरला होता?'),
  pb_msp: r('सरकारी खरीद (MSP)', 'MSP purchase', 'ਸਰਕਾਰੀ ਖਰੀਦ (MSP)', 'शासकीय खरेदी (MSP)'),
  pb_msp_d: r('निश्चित सरकारी भाव', 'Fixed government price', 'ਨਿਸ਼ਚਿਤ ਸਰਕਾਰੀ ਭਾਅ', 'निश्चित शासकीय भाव'),
  pb_ebid: r('ई-बोली (ऐप नीलामी)', 'e-Bid (app auction)', 'ਈ-ਬੋਲੀ (ਐਪ ਨਿਲਾਮੀ)', 'ई-बोली (अ‍ॅप लिलाव)'),
  pb_ebid_d: r('भाव ऐप में दर्ज है, पर्ची की ज़रूरत नहीं', 'Price is recorded in the app, no parchi needed', 'ਭਾਅ ਐਪ ਵਿੱਚ ਦਰਜ ਹੈ, ਪਰਚੀ ਦੀ ਲੋੜ ਨਹੀਂ', 'भाव अ‍ॅपमध्ये नोंदलेला आहे, पर्चीची गरज नाही'),
  pb_offline: r('ऑफलाइन बोली (आढ़ती)', 'Offline bid (arhtiya)', 'ਆਫਲਾਈਨ ਬੋਲੀ (ਆੜ੍ਹਤੀ)', 'ऑफलाइन बोली (अडते)'),
  pb_offline_d: r('मुनीम की पर्ची की फोटो ज़रूरी', 'Photo of the munim\'s parchi is required', 'ਮੁਨੀਮ ਦੀ ਪਰਚੀ ਦੀ ਫੋਟੋ ਜ਼ਰੂਰੀ', 'मुनीमच्या पर्चीचा फोटो आवश्यक'),
  pc_title: r('मुनीम की पर्ची', 'Munim\'s parchi', 'ਮੁਨੀਮ ਦੀ ਪਰਚੀ', 'मुनीमची पर्ची'),
  pc_hint: r('किसान से आढ़ती की पर्ची लें और उसकी फोटो खींचें। यह किसान के लिए दूसरी पुष्टि है कि उसे वही भाव मिल रहा है जो बोली में बताया गया था।', 'Take the arhtiya\'s parchi from the farmer and photograph it. It is the farmer\'s second confirmation that he is paid the rate he was told at the bid.', 'ਕਿਸਾਨ ਤੋਂ ਆੜ੍ਹਤੀ ਦੀ ਪਰਚੀ ਲਓ ਅਤੇ ਉਸਦੀ ਫੋਟੋ ਖਿੱਚੋ। ਇਹ ਕਿਸਾਨ ਲਈ ਦੂਜੀ ਪੁਸ਼ਟੀ ਹੈ ਕਿ ਉਸਨੂੰ ਉਹੀ ਭਾਅ ਮਿਲ ਰਿਹਾ ਹੈ ਜੋ ਬੋਲੀ ਵਿੱਚ ਦੱਸਿਆ ਗਿਆ ਸੀ।', 'शेतकऱ्याकडून अडत्याची पर्ची घ्या आणि तिचा फोटो काढा. बोलीत सांगितलेलाच भाव मिळतो आहे याची ही शेतकऱ्यासाठी दुसरी खात्री आहे.'),
  pc_takePhoto: r('📷 फोटो खींचें', '📷 Take photo', '📷 ਫੋਟੋ ਖਿੱਚੋ', '📷 फोटो काढा'),
  pc_gallery: r('गैलरी से चुनें', 'Choose from gallery', 'ਗੈਲਰੀ ਤੋਂ ਚੁਣੋ', 'गॅलरीतून निवडा'),
  pc_retake: r('दोबारा खींचें', 'Retake', 'ਦੁਬਾਰਾ ਖਿੱਚੋ', 'पुन्हा काढा'),
  pc_remove: r('हटाएँ', 'Remove', 'ਹਟਾਓ', 'काढून टाका'),
  pc_rate: r('पर्ची पर लिखा भाव (₹ / क्विंटल)', 'Rate written on the parchi (₹ / qtl)', 'ਪਰਚੀ ਉੱਤੇ ਲਿਖਿਆ ਭਾਅ (₹ / ਕੁਇੰਟਲ)', 'पर्चीवर लिहिलेला भाव (₹ / क्विंटल)'),
  pc_note: r('टिप्पणी (वैकल्पिक)', 'Note (optional)', 'ਟਿੱਪਣੀ (ਵਿਕਲਪਿਕ)', 'टीप (ऐच्छिक)'),
  pc_notePh: r('जैसे: आढ़ती का नाम', 'e.g. arhtiya\'s name', 'ਜਿਵੇਂ: ਆੜ੍ਹਤੀ ਦਾ ਨਾਮ', 'उदा. अडत्याचे नाव'),
  pc_match: r('✓ पर्ची का भाव तय भाव से मेल खाता है', '✓ Parchi rate matches the fixed rate', '✓ ਪਰਚੀ ਦਾ ਭਾਅ ਤੈਅ ਭਾਅ ਨਾਲ ਮੇਲ ਖਾਂਦਾ ਹੈ', '✓ पर्चीवरील भाव ठरलेल्या भावाशी जुळतो'),
  pc_mismatch: r('⚠ पर्ची का भाव ₹{a} है, ऐप में तय भाव ₹{b}। यह अंतर रिकॉर्ड में दर्ज होगा।', '⚠ Parchi says ₹{a}, app has ₹{b}. This difference will be saved on the record.', '⚠ ਪਰਚੀ ਦਾ ਭਾਅ ₹{a} ਹੈ, ਐਪ ਵਿੱਚ ਤੈਅ ਭਾਅ ₹{b}। ਇਹ ਅੰਤਰ ਰਿਕਾਰਡ ਵਿੱਚ ਦਰਜ ਹੋਵੇਗਾ।', '⚠ पर्चीवर ₹{a} आहे, अ‍ॅपमध्ये ₹{b}. हा फरक नोंदीत जतन होईल.'),
  pc_needPhoto: r('ऑफलाइन बोली के लिए मुनीम की पर्ची की फोटो ज़रूरी है।', 'A photo of the munim\'s parchi is required for an offline bid.', 'ਆਫਲਾਈਨ ਬੋਲੀ ਲਈ ਮੁਨੀਮ ਦੀ ਪਰਚੀ ਦੀ ਫੋਟੋ ਜ਼ਰੂਰੀ ਹੈ।', 'ऑफलाइन बोलीसाठी मुनीमच्या पर्चीचा फोटो आवश्यक आहे.'),
  pc_needRate: r('पर्ची पर लिखा भाव दर्ज करें।', 'Enter the rate written on the parchi.', 'ਪਰਚੀ ਉੱਤੇ ਲਿਖਿਆ ਭਾਅ ਦਰਜ ਕਰੋ।', 'पर्चीवर लिहिलेला भाव नोंदवा.'),
  pc_camPerm: r('कैमरा अनुमति नहीं मिली।', 'Camera permission was not granted.', 'ਕੈਮਰਾ ਇਜਾਜ਼ਤ ਨਹੀਂ ਮਿਲੀ।', 'कॅमेरा परवानगी मिळाली नाही.'),
  pc_photoFail: r('फोटो नहीं ली जा सकी।', 'Could not capture the photo.', 'ਫੋਟੋ ਨਹੀਂ ਲਈ ਜਾ ਸਕੀ।', 'फोटो घेता आला नाही.'),
  pc_attached: r('पर्ची संलग्न', 'Parchi attached', 'ਪਰਚੀ ਨੱਥੀ', 'पर्ची जोडली'),
  pc_farmerTitle: r('आढ़ती की पर्ची (दूसरी पुष्टि)', 'Arhtiya\'s parchi (second confirmation)', 'ਆੜ੍ਹਤੀ ਦੀ ਪਰਚੀ (ਦੂਜੀ ਪੁਸ਼ਟੀ)', 'अडत्याची पर्ची (दुसरी खात्री)'),
  pc_farmerHint: r('कैशियर ने भुगतान के समय आपकी पर्ची की फोटो ली। बोली का भाव और भुगतान का भाव मिलाकर देखें।', 'The cashier photographed your parchi at payment. Compare the bid rate with the paid rate.', 'ਕੈਸ਼ੀਅਰ ਨੇ ਭੁਗਤਾਨ ਵੇਲੇ ਤੁਹਾਡੀ ਪਰਚੀ ਦੀ ਫੋਟੋ ਲਈ। ਬੋਲੀ ਦਾ ਭਾਅ ਅਤੇ ਭੁਗਤਾਨ ਦਾ ਭਾਅ ਮਿਲਾ ਕੇ ਵੇਖੋ।', 'कॅशियरने देयकाच्या वेळी तुमच्या पर्चीचा फोटो घेतला. बोलीचा भाव आणि दिलेला भाव जुळवून पहा.'),
  pc_parchiRate: r('पर्ची का भाव', 'Parchi rate', 'ਪਰਚੀ ਦਾ ਭਾਅ', 'पर्चीचा भाव'),
  pc_paidRate: r('भुगतान का भाव', 'Paid rate', 'ਭੁਗਤਾਨ ਦਾ ਭਾਅ', 'दिलेला भाव'),
  pc_tapToView: r('बड़ा देखने के लिए टैप करें', 'Tap to view full size', 'ਵੱਡਾ ਵੇਖਣ ਲਈ ਟੈਪ ਕਰੋ', 'मोठे पाहण्यासाठी टॅप करा'),
  pc_capturedBy: r('{by} द्वारा {at} को ली गई', 'Captured by {by} on {at}', '{by} ਵੱਲੋਂ {at} ਨੂੰ ਲਈ ਗਈ', '{by} यांनी {at} रोजी घेतली'),
  pc_pdfPage: r('पृष्ठ 2 — आढ़ती की पर्ची (मुनीम द्वारा जारी)', 'Page 2 — Arhtiya\'s parchi (issued by the munim)', 'ਪੰਨਾ 2 — ਆੜ੍ਹਤੀ ਦੀ ਪਰਚੀ (ਮੁਨੀਮ ਵੱਲੋਂ ਜਾਰੀ)', 'पान 2 — अडत्याची पर्ची (मुनीमने दिलेली)'),
  pc_bothSlips: r('दो रसीदें', 'Two receipts', 'ਦੋ ਰਸੀਦਾਂ', 'दोन पावत्या'),
  pc_bothSlipsSub: r('1. APMC कैशियर की आधिकारिक रसीद  2. आढ़ती के मुनीम की पर्ची', '1. Official receipt from the APMC cashier  2. Parchi from the arhtiya\'s munim', '1. APMC ਕੈਸ਼ੀਅਰ ਦੀ ਅਧਿਕਾਰਤ ਰਸੀਦ  2. ਆੜ੍ਹਤੀ ਦੇ ਮੁਨੀਮ ਦੀ ਪਰਚੀ', '1. APMC कॅशियरची अधिकृत पावती  2. अडत्याच्या मुनीमची पर्ची'),
  pc_downloadBoth: r('⬇  रसीद + पर्ची PDF', '⬇  Receipt + parchi PDF', '⬇  ਰਸੀਦ + ਪਰਚੀ PDF', '⬇  पावती + पर्ची PDF'),
  pc_officialTitle: r('APMC कैशियर की आधिकारिक रसीद', 'Official receipt (APMC cashier)', 'APMC ਕੈਸ਼ੀਅਰ ਦੀ ਅਧਿਕਾਰਤ ਰਸੀਦ', 'APMC कॅशियरची अधिकृत पावती'),


  // ---- Help centre & bug report (install14) ----
  hc_title: r('सहायता केंद्र', 'Help centre', 'ਸਹਾਇਤਾ ਕੇਂਦਰ', 'मदत केंद्र'),
  hc_sub: r('सवाल चुनें, या समस्या रिपोर्ट करें', 'Pick a question, or report a problem', 'ਸਵਾਲ ਚੁਣੋ, ਜਾਂ ਸਮੱਸਿਆ ਰਿਪੋਰਟ ਕਰੋ', 'प्रश्न निवडा किंवा समस्या नोंदवा'),
  hc_faq: r('अक्सर पूछे जाने वाले सवाल', 'Common questions', 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ', 'नेहमीचे प्रश्न'),
  hc_report: r('समस्या रिपोर्ट करें', 'Report a problem', 'ਸਮੱਸਿਆ ਰਿਪੋਰਟ ਕਰੋ', 'समस्या नोंदवा'),
  hc_reportHint: r('क्या हुआ, किस स्क्रीन पर? टीम इसे सीधे देखेगी।', 'What happened, on which screen? The team sees this directly.', 'ਕੀ ਹੋਇਆ, ਕਿਸ ਸਕ੍ਰੀਨ ਉੱਤੇ? ਟੀਮ ਇਸਨੂੰ ਸਿੱਧਾ ਵੇਖੇਗੀ।', 'काय झाले, कोणत्या स्क्रीनवर? टीम हे थेट पाहील.'),
  hc_reportPh: r('जैसे: भुगतान पेज पर फोटो लेने के बाद ऐप बंद हो गया', 'e.g. app closed after taking the photo on the payment page', 'ਜਿਵੇਂ: ਭੁਗਤਾਨ ਪੰਨੇ ਉੱਤੇ ਫੋਟੋ ਲੈਣ ਤੋਂ ਬਾਅਦ ਐਪ ਬੰਦ ਹੋ ਗਈ', 'उदा. देयक पानावर फोटो घेतल्यावर अ‍ॅप बंद झाले'),
  hc_send: r('भेजें', 'Send', 'ਭੇਜੋ', 'पाठवा'),
  hc_sent: r('धन्यवाद! रिपोर्ट भेज दी गई।', 'Thank you! Report sent.', 'ਧੰਨਵਾਦ! ਰਿਪੋਰਟ ਭੇਜ ਦਿੱਤੀ ਗਈ।', 'धन्यवाद! अहवाल पाठवला.'),
  hc_empty: r('कृपया कुछ लिखें।', 'Please write something.', 'ਕਿਰਪਾ ਕਰਕੇ ਕੁਝ ਲਿਖੋ।', 'कृपया काहीतरी लिहा.'),
  hc_sendFail: r('भेज नहीं पाए। इंटरनेट देखें।', 'Could not send. Check the internet.', 'ਭੇਜ ਨਹੀਂ ਸਕੇ। ਇੰਟਰਨੈੱਟ ਵੇਖੋ।', 'पाठवता आले नाही. इंटरनेट तपासा.'),
  hc_callMandi: r('मंडी कार्यालय को कॉल करें', 'Call the mandi office', 'ਮੰਡੀ ਦਫ਼ਤਰ ਨੂੰ ਕਾਲ ਕਰੋ', 'मंडी कार्यालयाला कॉल करा'),
  hc_whatsapp: r('WhatsApp पर पूछें', 'Ask on WhatsApp', 'WhatsApp ਉੱਤੇ ਪੁੱਛੋ', 'WhatsApp वर विचारा'),
  hc_version: r('ऐप संस्करण', 'App version', 'ਐਪ ਵਰਜਨ', 'अ‍ॅप आवृत्ती'),

  faq_f1_q: r('टोकन कैसे बुक करूँ?', 'How do I book a token?', 'ਟੋਕਨ ਕਿਵੇਂ ਬੁੱਕ ਕਰਾਂ?', 'टोकन कसे बुक करू?'),
  faq_f1_a: r('To book a token, open the Booking section, select your mandi, crop and preferred date/slot, enter the required details, and confirm your booking. Your token number will be shown after successful booking.', 'To book a token, open the Booking section, select your mandi, crop and preferred date/slot, enter the required details, and confirm your booking. Your token number will be shown after successful booking.', 'To book a token, open the Booking section, select your mandi, crop and preferred date/slot, enter the required details, and confirm your booking. Your token number will be shown after successful booking.', 'To book a token, open the Booking section, select your mandi, crop and preferred date/slot, enter the required details, and confirm your booking. Your token number will be shown after successful booking.'),
  faq_f2_q: r('हरी बत्ती का क्या मतलब है?', 'What does the green light mean?', 'ਹਰੀ ਬੱਤੀ ਦਾ ਕੀ ਮਤਲਬ ਹੈ?', 'हिरव्या दिव्याचा अर्थ काय?'),
  faq_f2_a: r('The green light means your turn/entry status is active and you can proceed according to the current mandi instructions. Please follow the status shown in your booking.', 'The green light means your turn/entry status is active and you can proceed according to the current mandi instructions. Please follow the status shown in your booking.', 'The green light means your turn/entry status is active and you can proceed according to the current mandi instructions. Please follow the status shown in your booking.', 'The green light means your turn/entry status is active and you can proceed according to the current mandi instructions. Please follow the status shown in your booking.'),
  faq_f3_q: r('गेट पर क्या दिखाना होगा?', 'What do I show at the gate?', 'ਗੇਟ ਉੱਤੇ ਕੀ ਵਿਖਾਉਣਾ ਹੋਵੇਗਾ?', 'गेटवर काय दाखवावे लागेल?'),
  faq_f3_a: r('At the gate, show your booking/token details and the required farmer/vehicle documents shown in your booking. Keep your token or gate-pass information ready for verification.', 'At the gate, show your booking/token details and the required farmer/vehicle documents shown in your booking. Keep your token or gate-pass information ready for verification.', 'At the gate, show your booking/token details and the required farmer/vehicle documents shown in your booking. Keep your token or gate-pass information ready for verification.', 'At the gate, show your booking/token details and the required farmer/vehicle documents shown in your booking. Keep your token or gate-pass information ready for verification.'),
  faq_f4_q: r('MSP और नीलामी में क्या फर्क है?', 'MSP or auction - what is the difference?', 'MSP ਅਤੇ ਨਿਲਾਮੀ ਵਿੱਚ ਕੀ ਫ਼ਰਕ ਹੈ?', 'MSP आणि लिलावात काय फरक?'),
  faq_f4_a: r('MSP procurement means eligible produce is procured at the announced Minimum Support Price, subject to the applicable procurement rules. In an auction, buyers bid against each other and the accepted bid determines the sale price.', 'MSP procurement means eligible produce is procured at the announced Minimum Support Price, subject to the applicable procurement rules. In an auction, buyers bid against each other and the accepted bid determines the sale price.', 'MSP procurement means eligible produce is procured at the announced Minimum Support Price, subject to the applicable procurement rules. In an auction, buyers bid against each other and the accepted bid determines the sale price.', 'MSP procurement means eligible produce is procured at the announced Minimum Support Price, subject to the applicable procurement rules. In an auction, buyers bid against each other and the accepted bid determines the sale price.'),
  faq_f5_q: r('रसीद कहाँ मिलेगी?', 'Where is my receipt?', 'ਰਸੀਦ ਕਿੱਥੇ ਮਿਲੇਗੀ?', 'पावती कुठे मिळेल?'),
  faq_f5_a: r('After your transaction is completed, you can check your payment/receipt details from your booking or payment section in the app. Your receipt/reference details will be shown there when available.', 'After your transaction is completed, you can check your payment/receipt details from your booking or payment section in the app. Your receipt/reference details will be shown there when available.', 'After your transaction is completed, you can check your payment/receipt details from your booking or payment section in the app. Your receipt/reference details will be shown there when available.', 'After your transaction is completed, you can check your payment/receipt details from your booking or payment section in the app. Your receipt/reference details will be shown there when available.'),
  faq_f6_q: r('बुकिंग रद्द कैसे करूँ?', 'How do I cancel a booking?', 'ਬੁਕਿੰਗ ਰੱਦ ਕਿਵੇਂ ਕਰਾਂ?', 'बुकिंग रद्द कशी करू?'),
  faq_f6_a: r('You can cancel your booking before 48 hours of the scheduled slot. Open your booking, choose the cancellation option, and confirm the cancellation. Bookings within 48 hours of the slot cannot be cancelled through this option.', 'You can cancel your booking before 48 hours of the scheduled slot. Open your booking, choose the cancellation option, and confirm the cancellation. Bookings within 48 hours of the slot cannot be cancelled through this option.', 'You can cancel your booking before 48 hours of the scheduled slot. Open your booking, choose the cancellation option, and confirm the cancellation. Bookings within 48 hours of the slot cannot be cancelled through this option.', 'You can cancel your booking before 48 hours of the scheduled slot. Open your booking, choose the cancellation option, and confirm the cancellation. Bookings within 48 hours of the slot cannot be cancelled through this option.'),

  faq_o1_q: r('मुझे कोई टोकन क्यों नहीं दिख रहा?', 'Why do I see no tokens?', 'ਮੈਨੂੰ ਕੋਈ ਟੋਕਨ ਕਿਉਂ ਨਹੀਂ ਦਿਖ ਰਿਹਾ?', 'मला टोकन का दिसत नाहीत?'),
  faq_o1_a: r('प्रोफ़ाइल में अपनी मंडी और ड्यूटी चुनें। आपको केवल उसी मंडी के, आपके चरण के टोकन दिखते हैं।', 'Choose your mandi and duty in Profile. You only see tokens from that mandi, at your stage.', 'ਪ੍ਰੋਫ਼ਾਈਲ ਵਿੱਚ ਆਪਣੀ ਮੰਡੀ ਅਤੇ ਡਿਊਟੀ ਚੁਣੋ। ਤੁਹਾਨੂੰ ਸਿਰਫ਼ ਉਸੇ ਮੰਡੀ ਦੇ, ਤੁਹਾਡੇ ਪੜਾਅ ਦੇ ਟੋਕਨ ਦਿਖਦੇ ਹਨ।', 'प्रोफाइलमध्ये तुमची मंडी आणि ड्युटी निवडा. तुम्हाला फक्त त्या मंडीचे, तुमच्या टप्प्याचे टोकन दिसतात.'),
  faq_o2_q: r('गेट पास स्कैन नहीं हो रहा', 'The gate pass will not scan', 'ਗੇਟ ਪਾਸ ਸਕੈਨ ਨਹੀਂ ਹੋ ਰਿਹਾ', 'गेट पास स्कॅन होत नाही'),
  faq_o2_a: r('किसान से 6 अंकों का नंबर पूछकर टाइप करें, या टोकन नंबर (A-03) डालें। कैमरा अनुमति सेटिंग्स में देखें।', 'Ask the farmer for the 6-digit number and type it, or type the token number (A-03). Check camera permission in Settings.', 'ਕਿਸਾਨ ਤੋਂ 6 ਅੰਕਾਂ ਦਾ ਨੰਬਰ ਪੁੱਛ ਕੇ ਟਾਈਪ ਕਰੋ, ਜਾਂ ਟੋਕਨ ਨੰਬਰ (A-03) ਪਾਓ। ਕੈਮਰਾ ਇਜਾਜ਼ਤ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਵੇਖੋ।', 'शेतकऱ्याकडून 6 अंकी क्रमांक विचारून टाइप करा किंवा टोकन क्रमांक (A-03) टाका. सेटिंग्जमध्ये कॅमेरा परवानगी तपासा.'),
  faq_o3_q: r('तौल क्यों नहीं हो रही?', 'Why can I not weigh?', 'ਤੋਲ ਕਿਉਂ ਨਹੀਂ ਹੋ ਰਹੀ?', 'वजन का करता येत नाही?'),
  faq_o3_a: r('तौल से पहले भाव तय होना ज़रूरी है (MSP या नीलामी)। किसान अपने टोकन पेज से भाव तय करता है।', 'The price must be fixed before weighing (MSP or auction). The farmer fixes it from his token page.', 'ਤੋਲ ਤੋਂ ਪਹਿਲਾਂ ਭਾਅ ਤੈਅ ਹੋਣਾ ਜ਼ਰੂਰੀ ਹੈ (MSP ਜਾਂ ਨਿਲਾਮੀ)। ਕਿਸਾਨ ਆਪਣੇ ਟੋਕਨ ਪੰਨੇ ਤੋਂ ਭਾਅ ਤੈਅ ਕਰਦਾ ਹੈ।', 'वजनापूर्वी भाव ठरलेला असावा (MSP किंवा लिलाव). शेतकरी त्याच्या टोकन पानावरून भाव ठरवतो.'),
  faq_o4_q: r('पर्ची कब ज़रूरी है?', 'When is the parchi required?', 'ਪਰਚੀ ਕਦੋਂ ਜ਼ਰੂਰੀ ਹੈ?', 'पर्ची कधी आवश्यक आहे?'),
  faq_o4_a: r('केवल "ऑफलाइन बोली" चुनने पर। MSP और ई-बोली में भाव ऐप में पहले से दर्ज है, पर्ची नहीं मांगी जाती।', 'Only when you choose "Offline bid". For MSP and e-Bid the price is already in the app; no parchi is asked.', 'ਸਿਰਫ਼ "ਆਫਲਾਈਨ ਬੋਲੀ" ਚੁਣਨ ਉੱਤੇ। MSP ਅਤੇ ਈ-ਬੋਲੀ ਵਿੱਚ ਭਾਅ ਐਪ ਵਿੱਚ ਪਹਿਲਾਂ ਤੋਂ ਦਰਜ ਹੈ, ਪਰਚੀ ਨਹੀਂ ਮੰਗੀ ਜਾਂਦੀ।', 'फक्त "ऑफलाइन बोली" निवडल्यावर. MSP आणि ई-बोलीत भाव आधीच अ‍ॅपमध्ये असतो; पर्ची मागितली जात नाही.'),

  faq_t1_q: r('मुझे लॉट क्यों नहीं दिख रहे?', 'Why do I see no lots?', 'ਮੈਨੂੰ ਲਾਟ ਕਿਉਂ ਨਹੀਂ ਦਿਖ ਰਹੇ?', 'मला लॉट का दिसत नाहीत?'),
  faq_t1_a: r('प्रोफ़ाइल में अपनी व्यापार की मंडी चुनें। लॉट तभी आते हैं जब किसान गुणवत्ता जांच के बाद नीलामी शुरू करता है।', 'Choose your trading mandi in Profile. Lots appear only when a farmer starts an auction after the quality check.', 'ਪ੍ਰੋਫ਼ਾਈਲ ਵਿੱਚ ਆਪਣੀ ਵਪਾਰ ਦੀ ਮੰਡੀ ਚੁਣੋ। ਲਾਟ ਤਾਂ ਹੀ ਆਉਂਦੇ ਹਨ ਜਦੋਂ ਕਿਸਾਨ ਗੁਣਵੱਤਾ ਜਾਂਚ ਤੋਂ ਬਾਅਦ ਨਿਲਾਮੀ ਸ਼ੁਰੂ ਕਰਦਾ ਹੈ।', 'प्रोफाइलमध्ये तुमची व्यापाराची मंडी निवडा. गुणवत्ता तपासणीनंतर शेतकरी लिलाव सुरू करतो तेव्हाच लॉट दिसतात.'),
  faq_t2_q: r('बोली के नियम क्या हैं?', 'What are the bidding rules?', 'ਬੋਲੀ ਦੇ ਨਿਯਮ ਕੀ ਹਨ?', 'बोलीचे नियम काय?'),
  faq_t2_a: r('न्यूनतम भाव MSP। हर बोली पिछली से कम से कम ₹5 ऊपर। 10 मिनट, अंत के 1 मिनट में बोली आने पर समय बढ़ता है। बोली वापस नहीं होती। किसान अंत में स्वीकार/अस्वीकार करता है।', 'Floor is MSP. Each bid at least ₹5 above the last. 10 minutes; a bid in the final minute extends the time. Bids cannot be withdrawn. The farmer accepts or rejects at the end.', 'ਘੱਟੋ-ਘੱਟ ਭਾਅ MSP। ਹਰ ਬੋਲੀ ਪਿਛਲੀ ਤੋਂ ਘੱਟੋ-ਘੱਟ ₹5 ਉੱਪਰ। 10 ਮਿੰਟ, ਅੰਤ ਦੇ 1 ਮਿੰਟ ਵਿੱਚ ਬੋਲੀ ਆਉਣ ਉੱਤੇ ਸਮਾਂ ਵਧਦਾ ਹੈ। ਬੋਲੀ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀ। ਕਿਸਾਨ ਅੰਤ ਵਿੱਚ ਸਵੀਕਾਰ/ਅਸਵੀਕਾਰ ਕਰਦਾ ਹੈ।', 'किमान भाव MSP. प्रत्येक बोली मागीलपेक्षा किमान ₹5 जास्त. 10 मिनिटे; शेवटच्या मिनिटात बोली आल्यास वेळ वाढतो. बोली मागे घेता येत नाही. शेवटी शेतकरी स्वीकारतो/नाकारतो.'),
  faq_t3_q: r('जीतने के बाद क्या?', 'What happens after I win?', 'ਜਿੱਤਣ ਤੋਂ ਬਾਅਦ ਕੀ?', 'जिंकल्यानंतर काय?'),
  faq_t3_a: r('लॉट तौल पर जाता है, फिर कैशियर रसीद बनाता है। "मेरी खरीद" में तौला हुआ वजन और कुल राशि दिखेगी।', 'The lot goes to weighing, then the cashier issues the receipt. "My purchases" shows the weighed quantity and total.', 'ਲਾਟ ਤੋਲ ਉੱਤੇ ਜਾਂਦਾ ਹੈ, ਫਿਰ ਕੈਸ਼ੀਅਰ ਰਸੀਦ ਬਣਾਉਂਦਾ ਹੈ। "ਮੇਰੀ ਖਰੀਦ" ਵਿੱਚ ਤੋਲਿਆ ਹੋਇਆ ਵਜ਼ਨ ਅਤੇ ਕੁੱਲ ਰਕਮ ਦਿਖੇਗੀ।', 'लॉट वजनासाठी जातो, मग कॅशियर पावती देतो. "माझी खरेदी" मध्ये वजन केलेले प्रमाण आणि एकूण रक्कम दिसेल.'),

  audio_welcome: r(
    'एग्रोब्रिज में आपका स्वागत है। यह ऐप किसानों को मंडी गेट स्लॉट बुक करने और घंटों के इंतजार से बचाने के लिए बनाया गया है। आगे बढ़ने के लिए नीचे दिए गए बटन पर टैप करें।',
    'Welcome to AgroBridge. This app helps farmers book mandi gate slots and avoid long waits. Tap Get Started to continue.',
    'ਐਗਰੋਬ੍ਰਿਜ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ। ਇਹ ਐਪ ਕਿਸਾਨਾਂ ਨੂੰ ਮੰਡੀ ਗੇਟ ਸਲਾਟ ਬੁੱਕ ਕਰਨ ਅਤੇ ਘੰਟਿਆਂ ਦੀ ਉਡੀਕ ਤੋਂ ਬਚਾਉਣ ਲਈ ਹੈ। ਅੱਗੇ ਵਧਣ ਲਈ ਹੇਠਾਂ ਬਟਨ ਦਬਾਓ।',
    'अ‍ॅग्रोब्रिज मध्ये स्वागत आहे. हे अ‍ॅप शेतकऱ्यांना मंडी गेट स्लॉट बुक करण्यास आणि तासन्‌तास प्रतीक्षा टाळण्यास मदत करते. पुढे जाण्यासाठी खालील बटण दाबा.'
  ),
  audio_role: r(
    'अपनी भूमिका चुनें। यदि आप फसल बेचने वाले किसान हैं, तो किसान चुनें। यदि आप मंडी में गेट, जांच, तौल या खाता संभालते हैं, तो मंडी अधिकारी चुनें। यदि आप फसल खरीदने वाले व्यापारी हैं, तो व्यापारी चुनें।',
    'Select your role. If you are a farmer selling crops, tap Farmer. If you work at the mandi gate, assay, weighbridge or accounts, tap Mandi Officer. If you buy crops, tap Trader.',
    'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ। ਜੇ ਤੁਸੀਂ ਫਸਲ ਵੇਚਣ ਵਾਲੇ ਕਿਸਾਨ ਹੋ ਤਾਂ ਕਿਸਾਨ ਚੁਣੋ। ਜੇ ਤੁਸੀਂ ਮੰਡੀ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਹੋ ਤਾਂ ਮੰਡੀ ਅਧਿਕਾਰੀ ਚੁਣੋ। ਜੇ ਤੁਸੀਂ ਫਸਲ ਖਰੀਦਦੇ ਹੋ ਤਾਂ ਵਪਾਰੀ ਚੁਣੋ।',
    'तुमची भूमिका निवडा. तुम्ही पीक विकणारे शेतकरी असाल तर शेतकरी निवडा. मंडीत काम करत असाल तर मंडी अधिकारी निवडा. पीक खरेदी करत असाल तर व्यापारी निवडा.'
  ),
  audio_farmer_dashboard: r(
    'यह आपका मुख्य किसान पेज है। मंडी जाने के लिए स्लॉट बुक करें दबाएं। बुकिंग के बाद ऊपर आपका टोकन, कतार में आपसे आगे कितने हैं और अभी कौन सा टोकन चल रहा है दिखेगा। हरी बत्ती जलते ही गेट पर जाएं। फ़ोन पर बुक करें दबाने से हम आपको कॉल करके भी बुकिंग करा सकते हैं।',
    'This is your farmer home page. Tap Book Slot to go to the mandi. After booking, the top shows your token, how many are ahead of you and which token is being served now. When the light turns green, go to the gate. Tap Book by phone call and we will call you to book by voice.',
    'ਇਹ ਤੁਹਾਡਾ ਮੁੱਖ ਕਿਸਾਨ ਪੇਜ ਹੈ। ਮੰਡੀ ਜਾਣ ਲਈ ਸਲਾਟ ਬੁੱਕ ਕਰੋ ਦਬਾਓ। ਬੁਕਿੰਗ ਤੋਂ ਬਾਅਦ ਉੱਪਰ ਤੁਹਾਡਾ ਟੋਕਨ, ਤੁਹਾਡੇ ਤੋਂ ਅੱਗੇ ਕਿੰਨੇ ਹਨ ਅਤੇ ਹੁਣ ਕਿਹੜਾ ਟੋਕਨ ਚੱਲ ਰਿਹਾ ਹੈ ਦਿਖੇਗਾ। ਹਰੀ ਬੱਤੀ ਜਗਦੇ ਹੀ ਗੇਟ ਤੇ ਜਾਓ। ਫ਼ੋਨ ਤੇ ਬੁੱਕ ਕਰੋ ਦਬਾਉਣ ਨਾਲ ਅਸੀਂ ਕਾਲ ਕਰਕੇ ਬੁਕਿੰਗ ਕਰਵਾ ਸਕਦੇ ਹਾਂ।',
    'हे तुमचे मुख्य शेतकरी पेज आहे. मंडीत जाण्यासाठी स्लॉट बुक करा दाबा. बुकिंगनंतर वर तुमचे टोकन, तुमच्या पुढे किती आहेत आणि आता कोणते टोकन सुरू आहे दिसेल. हिरवा दिवा लागताच गेटवर जा. फोनवर बुक करा दाबल्यास आम्ही कॉल करून बुकिंग करू शकतो.'
  ),
  audio_crop: r(
    'पहला चरण। वह फसल चुनें जिसे आप आज मंडी में बेचने जा रहे हैं। फसल चुनने के बाद नीचे आगे बढ़ें बटन पर टैप करें।',
    'Step one. Select the crop you will sell at the mandi today, then tap Continue below.',
    'ਪਹਿਲਾ ਪੜਾਅ। ਜੋ ਫਸਲ ਅੱਜ ਮੰਡੀ ਵਿੱਚ ਵੇਚਣੀ ਹੈ ਉਹ ਚੁਣੋ, ਫਿਰ ਹੇਠਾਂ ਅੱਗੇ ਵਧੋ ਦਬਾਓ।',
    'पहिली पायरी. आज मंडीत विकायचे पीक निवडा आणि खालील पुढे जा बटण दाबा.'
  ),
  audio_centre: r(
    'दूसरा चरण। अपनी निकटतम मंडी चुनें। सबसे पास की मंडी ऊपर दिखाई गई है। मंडी चुनकर आगे बढ़ें।',
    'Step two. Select your nearest mandi. The closest one is shown at the top. Choose and continue.',
    'ਦੂਜਾ ਪੜਾਅ। ਆਪਣੀ ਨਜ਼ਦੀਕੀ ਮੰਡੀ ਚੁਣੋ। ਸਭ ਤੋਂ ਨੇੜਲੀ ਮੰਡੀ ਉੱਪਰ ਹੈ। ਚੁਣ ਕੇ ਅੱਗੇ ਵਧੋ।',
    'दुसरी पायरी. तुमची जवळची मंडी निवडा. सर्वात जवळची मंडी वर दाखवली आहे. निवडून पुढे जा.'
  ),
  audio_slot: r(
    'तीसरा चरण। अपनी सुविधा अनुसार आगमन की तारीख और समय चुनें, फिर आगे बढ़ें।',
    'Step three. Choose your arrival date and time, then press Next.',
    'ਤੀਜਾ ਪੜਾਅ। ਆਮਦ ਦੀ ਤਾਰੀਖ ਅਤੇ ਸਮਾਂ ਚੁਣੋ, ਫਿਰ ਅੱਗੇ ਵਧੋ।',
    'तिसरी पायरी. येण्याची तारीख व वेळ निवडा, मग पुढे जा.'
  ),
  audio_officer_queue: r(
    'मंडी अधिकारी पोर्टल। आपके काम के कार्ड ऊपर हैं। गेट पर किसान का गेट पास स्कैन करके प्रवेश दें। जांच, तौल और भुगतान अपने-अपने कार्ड से करें।',
    'Mandi officer portal. Your work cards are at the top. At the gate, scan the farmer\'s gate pass to admit them. Assay, weighing and payment each have their own card.',
    'ਮੰਡੀ ਅਧਿਕਾਰੀ ਪੋਰਟਲ। ਤੁਹਾਡੇ ਕੰਮ ਦੇ ਕਾਰਡ ਉੱਪਰ ਹਨ। ਗੇਟ ਤੇ ਕਿਸਾਨ ਦਾ ਗੇਟ ਪਾਸ ਸਕੈਨ ਕਰਕੇ ਐਂਟਰੀ ਦਿਓ।',
    'मंडी अधिकारी पोर्टल. तुमची कामाची कार्डे वर आहेत. गेटवर शेतकऱ्याचा गेट पास स्कॅन करून प्रवेश द्या.'
  ),

  /* ------------------------------------------------------------ */
  /* Voice help per screen (install21) - key = audio_<RouteName>    */
  /* Spoken when the speaker icon in the header is tapped.          */
  /* Screens that pass their own audioKey keep using it.            */
  /* ------------------------------------------------------------ */
  audio_Login: r(
    'लॉगिन पेज। अपना दस अंकों का मोबाइल नंबर भरें और ओटीपी भेजें बटन दबाएं। आपके फ़ोन पर एक कोड आएगा। अगर आपका खाता नहीं है, तो पहले पंजीकरण करें।',
    'Login page. Enter your ten digit mobile number and tap Send OTP. A code will come to your phone. If you do not have an account yet, register first.',
    'ਲੌਗਇਨ ਪੇਜ। ਆਪਣਾ ਦਸ ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ ਅਤੇ ਓਟੀਪੀ ਭੇਜੋ ਦਬਾਓ। ਤੁਹਾਡੇ ਫ਼ੋਨ ਤੇ ਇੱਕ ਕੋਡ ਆਵੇਗਾ। ਜੇ ਖਾਤਾ ਨਹੀਂ ਹੈ ਤਾਂ ਪਹਿਲਾਂ ਰਜਿਸਟਰ ਕਰੋ।',
    'लॉगिन पेज. तुमचा दहा अंकी मोबाईल नंबर भरा आणि ओटीपी पाठवा दाबा. तुमच्या फोनवर एक कोड येईल. खाते नसेल तर आधी नोंदणी करा.'
  ),
  audio_Otp: r(
    'ओटीपी पेज। आपके फ़ोन पर आया चार अंकों का कोड यहाँ भरें और सत्यापित करें दबाएं। कोड न आए तो कुछ सेकंड रुककर दोबारा भेजें दबाएं।',
    'OTP page. Type the four digit code that came to your phone and tap Verify. If the code does not arrive, wait a few seconds and tap Resend.',
    'ਓਟੀਪੀ ਪੇਜ। ਫ਼ੋਨ ਤੇ ਆਇਆ ਚਾਰ ਅੰਕਾਂ ਦਾ ਕੋਡ ਇੱਥੇ ਭਰੋ ਅਤੇ ਪੁਸ਼ਟੀ ਕਰੋ ਦਬਾਓ। ਕੋਡ ਨਾ ਆਵੇ ਤਾਂ ਕੁਝ ਸਕਿੰਟ ਰੁਕ ਕੇ ਦੁਬਾਰਾ ਭੇਜੋ ਦਬਾਓ।',
    'ओटीपी पेज. फोनवर आलेला चार अंकी कोड येथे भरा आणि पडताळा दाबा. कोड आला नाही तर काही सेकंद थांबून पुन्हा पाठवा दाबा.'
  ),
  audio_Register: r(
    'पंजीकरण पेज। अपना नाम और मोबाइल नंबर भरें। किसान को बस इतना ही चाहिए। मंडी अधिकारी अपनी मंडी, ड्यूटी और कर्मचारी आईडी भी चुनें। फिर पंजीकरण करें दबाएं।',
    'Registration page. Enter your name and mobile number. That is all a farmer needs. Mandi officers also choose their mandi, duty and employee ID. Then tap Register.',
    'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਪੇਜ। ਆਪਣਾ ਨਾਮ ਅਤੇ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ। ਕਿਸਾਨ ਲਈ ਇੰਨਾ ਹੀ ਕਾਫ਼ੀ ਹੈ। ਮੰਡੀ ਅਧਿਕਾਰੀ ਆਪਣੀ ਮੰਡੀ, ਡਿਊਟੀ ਅਤੇ ਕਰਮਚਾਰੀ ਆਈਡੀ ਵੀ ਚੁਣਨ। ਫਿਰ ਰਜਿਸਟਰ ਕਰੋ ਦਬਾਓ।',
    'नोंदणी पेज. तुमचे नाव आणि मोबाईल नंबर भरा. शेतकऱ्यासाठी एवढेच पुरेसे आहे. मंडी अधिकाऱ्यांनी आपली मंडी, ड्युटी आणि कर्मचारी आयडी देखील निवडावा. मग नोंदणी करा दाबा.'
  ),
  audio_UserStatus: r(
    'यदि आपने पहले यह ऐप इस्तेमाल किया है तो लॉगिन दबाएं। पहली बार आए हैं तो नया पंजीकरण दबाएं।',
    'If you have used this app before, tap Login. If this is your first time, tap Register.',
    'ਜੇ ਤੁਸੀਂ ਪਹਿਲਾਂ ਇਹ ਐਪ ਵਰਤੀ ਹੈ ਤਾਂ ਲੌਗਇਨ ਦਬਾਓ। ਪਹਿਲੀ ਵਾਰ ਆਏ ਹੋ ਤਾਂ ਨਵੀਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਦਬਾਓ।',
    'तुम्ही आधी हे अ‍ॅप वापरले असेल तर लॉगिन दाबा. पहिल्यांदाच आला असाल तर नवीन नोंदणी दाबा.'
  ),
  audio_TokenConfirmation: r(
    'बधाई हो, आपका टोकन बुक हो गया है। यह आपका गेट पास है। इसमें टोकन नंबर, मंडी, तारीख और समय लिखा है। मंडी गेट पर यह क्यू आर कोड या छह अंकों का कोड दिखाएं। स्क्रीनशॉट लेकर रख लें, इंटरनेट न होने पर भी काम आएगा।',
    'Congratulations, your token is booked. This is your gate pass. It shows the token number, mandi, date and time. Show this QR code or the six digit code at the mandi gate. Take a screenshot so it works even without internet.',
    'ਵਧਾਈਆਂ, ਤੁਹਾਡਾ ਟੋਕਨ ਬੁੱਕ ਹੋ ਗਿਆ ਹੈ। ਇਹ ਤੁਹਾਡਾ ਗੇਟ ਪਾਸ ਹੈ। ਇਸ ਵਿੱਚ ਟੋਕਨ ਨੰਬਰ, ਮੰਡੀ, ਤਾਰੀਖ ਅਤੇ ਸਮਾਂ ਲਿਖਿਆ ਹੈ। ਮੰਡੀ ਗੇਟ ਤੇ ਇਹ ਕਿਊ ਆਰ ਕੋਡ ਜਾਂ ਛੇ ਅੰਕਾਂ ਦਾ ਕੋਡ ਦਿਖਾਓ। ਸਕ੍ਰੀਨਸ਼ਾਟ ਲੈ ਕੇ ਰੱਖੋ।',
    'अभिनंदन, तुमचे टोकन बुक झाले आहे. हा तुमचा गेट पास आहे. यात टोकन नंबर, मंडी, तारीख आणि वेळ आहे. मंडी गेटवर हा क्यूआर कोड किंवा सहा अंकी कोड दाखवा. स्क्रीनशॉट काढून ठेवा, इंटरनेट नसतानाही उपयोगी पडेल.'
  ),
  audio_TokenDetail: r(
    'टोकन विवरण पेज। ऊपर आपकी वर्तमान स्थिति है, जैसे बुक, गेट प्रवेश, जांच, तौल या भुगतान। हरी बत्ती का मतलब है अब आपकी बारी है, गेट पर जाएं। नीचे आपकी फसल का ग्रेड, भाव, वजन और भुगतान की जानकारी आती जाएगी। भुगतान होने पर यहीं से रसीद डाउनलोड करें।',
    'Token detail page. At the top is your current stage: booked, gate entry, assay, weighing or payment. A green light means it is your turn, go to the gate. Below, your grade, price, weight and payment details appear as they happen. Once paid, download the receipt from here.',
    'ਟੋਕਨ ਵੇਰਵਾ ਪੇਜ। ਉੱਪਰ ਤੁਹਾਡੀ ਮੌਜੂਦਾ ਸਥਿਤੀ ਹੈ, ਜਿਵੇਂ ਬੁੱਕ, ਗੇਟ ਐਂਟਰੀ, ਜਾਂਚ, ਤੋਲ ਜਾਂ ਭੁਗਤਾਨ। ਹਰੀ ਬੱਤੀ ਦਾ ਮਤਲਬ ਹੁਣ ਤੁਹਾਡੀ ਵਾਰੀ ਹੈ, ਗੇਟ ਤੇ ਜਾਓ। ਹੇਠਾਂ ਗ੍ਰੇਡ, ਭਾਅ, ਵਜ਼ਨ ਅਤੇ ਭੁਗਤਾਨ ਦੀ ਜਾਣਕਾਰੀ ਆਉਂਦੀ ਜਾਵੇਗੀ। ਭੁਗਤਾਨ ਹੋਣ ਤੇ ਇੱਥੋਂ ਰਸੀਦ ਡਾਊਨਲੋਡ ਕਰੋ।',
    'टोकन तपशील पेज. वर तुमची सध्याची स्थिती आहे: बुक, गेट प्रवेश, तपासणी, वजन किंवा पेमेंट. हिरवा दिवा म्हणजे आता तुमची पाळी, गेटवर जा. खाली ग्रेड, भाव, वजन आणि पेमेंटची माहिती येत जाईल. पेमेंट झाल्यावर येथून पावती डाउनलोड करा.'
  ),
  audio_History: r(
    'इतिहास पेज। यहाँ आपकी सभी पुरानी और चालू मंडी बुकिंग हैं। किसी भी टोकन पर टैप करके उसका पूरा विवरण और रसीद देखें।',
    'History page. All your past and current mandi bookings are here. Tap any token to see its full details and receipt.',
    'ਇਤਿਹਾਸ ਪੇਜ। ਇੱਥੇ ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਪੁਰਾਣੀਆਂ ਅਤੇ ਚਾਲੂ ਮੰਡੀ ਬੁਕਿੰਗਾਂ ਹਨ। ਕਿਸੇ ਵੀ ਟੋਕਨ ਤੇ ਟੈਪ ਕਰਕੇ ਪੂਰਾ ਵੇਰਵਾ ਅਤੇ ਰਸੀਦ ਵੇਖੋ।',
    'इतिहास पेज. येथे तुमच्या सर्व जुन्या आणि चालू मंडी बुकिंग आहेत. कोणत्याही टोकनवर टॅप करून संपूर्ण तपशील आणि पावती पहा.'
  ),
  audio_Payments: r(
    'भुगतान पेज। यहाँ आपकी हर बिक्री की राशि और भुगतान की स्थिति है। जिसमें भुगतान हो चुका है वहाँ से रसीद डाउनलोड या साझा कर सकते हैं।',
    'Payments page. Here is the amount and payment status of every sale. Where payment is done, you can download or share the receipt.',
    'ਭੁਗਤਾਨ ਪੇਜ। ਇੱਥੇ ਤੁਹਾਡੀ ਹਰ ਵਿਕਰੀ ਦੀ ਰਕਮ ਅਤੇ ਭੁਗਤਾਨ ਦੀ ਸਥਿਤੀ ਹੈ। ਜਿੱਥੇ ਭੁਗਤਾਨ ਹੋ ਚੁੱਕਾ ਹੈ ਉੱਥੋਂ ਰਸੀਦ ਡਾਊਨਲੋਡ ਜਾਂ ਸਾਂਝੀ ਕਰੋ।',
    'पेमेंट पेज. येथे तुमच्या प्रत्येक विक्रीची रक्कम आणि पेमेंटची स्थिती आहे. पेमेंट झाले असेल तिथून पावती डाउनलोड किंवा शेअर करा.'
  ),
  audio_Help: r(
    'सहायता केंद्र। यहाँ आम सवालों के जवाब हैं, जैसे टोकन कैसे बुक करें और भुगतान कब मिलेगा। नीचे से मंडी को कॉल या व्हाट्सएप कर सकते हैं, या कोई समस्या रिपोर्ट कर सकते हैं।',
    'Help centre. Answers to common questions are here, such as how to book a token and when payment arrives. At the bottom you can call or WhatsApp the mandi, or report a problem.',
    'ਸਹਾਇਤਾ ਕੇਂਦਰ। ਇੱਥੇ ਆਮ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਹਨ, ਜਿਵੇਂ ਟੋਕਨ ਕਿਵੇਂ ਬੁੱਕ ਕਰੀਏ ਅਤੇ ਭੁਗਤਾਨ ਕਦੋਂ ਮਿਲੇਗਾ। ਹੇਠਾਂ ਤੋਂ ਮੰਡੀ ਨੂੰ ਕਾਲ ਜਾਂ ਵਟਸਐਪ ਕਰੋ, ਜਾਂ ਸਮੱਸਿਆ ਰਿਪੋਰਟ ਕਰੋ।',
    'मदत केंद्र. येथे सामान्य प्रश्नांची उत्तरे आहेत, जसे टोकन कसे बुक करावे आणि पेमेंट कधी मिळेल. खालून मंडीला कॉल किंवा व्हॉट्सअ‍ॅप करा, किंवा समस्या नोंदवा.'
  ),
  audio_OfficerDashboard: r(
    'मंडी अधिकारी पोर्टल। ऊपर आज की संख्या है, कितने टोकन बुक हैं, कितने अंदर हैं और कितने पूरे हुए। आपकी ड्यूटी के कार्ड नीचे हैं। गेट अधिकारी गेट प्रवेश दबाकर किसान का पास स्कैन करें। जांच, तौल और भुगतान अपने-अपने कार्ड से करें।',
    'Mandi officer portal. Today\'s numbers are at the top: tokens booked, inside and completed. Your duty cards are below. Gate officers tap Gate Entry to scan the farmer\'s pass. Assay, weighing and payment each have their own card.',
    'ਮੰਡੀ ਅਧਿਕਾਰੀ ਪੋਰਟਲ। ਉੱਪਰ ਅੱਜ ਦੀ ਗਿਣਤੀ ਹੈ, ਕਿੰਨੇ ਟੋਕਨ ਬੁੱਕ ਹਨ, ਕਿੰਨੇ ਅੰਦਰ ਹਨ ਅਤੇ ਕਿੰਨੇ ਪੂਰੇ ਹੋਏ। ਤੁਹਾਡੀ ਡਿਊਟੀ ਦੇ ਕਾਰਡ ਹੇਠਾਂ ਹਨ। ਗੇਟ ਅਧਿਕਾਰੀ ਗੇਟ ਐਂਟਰੀ ਦਬਾ ਕੇ ਕਿਸਾਨ ਦਾ ਪਾਸ ਸਕੈਨ ਕਰਨ।',
    'मंडी अधिकारी पोर्टल. वर आजची संख्या आहे: किती टोकन बुक, किती आत आणि किती पूर्ण. तुमच्या ड्युटीची कार्डे खाली आहेत. गेट अधिकाऱ्यांनी गेट प्रवेश दाबून शेतकऱ्याचा पास स्कॅन करावा.'
  ),
  audio_GateScan: r(
    'गेट पास स्कैन। किसान के फ़ोन पर दिख रहे क्यू आर कोड पर कैमरा रखें, या नीचे उसका छह अंकों का कोड भरें। सही टोकन मिलने पर प्रवेश दें दबाएं। इससे किसान की स्क्रीन तुरंत बदल जाती है और अगले किसान को सूचना जाती है।',
    'Gate pass scan. Point the camera at the QR code on the farmer\'s phone, or type the six digit code below. When the correct token appears, tap Admit. The farmer\'s screen updates instantly and the next farmer is notified.',
    'ਗੇਟ ਪਾਸ ਸਕੈਨ। ਕਿਸਾਨ ਦੇ ਫ਼ੋਨ ਤੇ ਦਿਖ ਰਹੇ ਕਿਊ ਆਰ ਕੋਡ ਤੇ ਕੈਮਰਾ ਰੱਖੋ, ਜਾਂ ਹੇਠਾਂ ਉਸਦਾ ਛੇ ਅੰਕਾਂ ਦਾ ਕੋਡ ਭਰੋ। ਸਹੀ ਟੋਕਨ ਮਿਲਣ ਤੇ ਐਂਟਰੀ ਦਿਓ ਦਬਾਓ। ਇਸ ਨਾਲ ਕਿਸਾਨ ਦੀ ਸਕ੍ਰੀਨ ਤੁਰੰਤ ਬਦਲ ਜਾਂਦੀ ਹੈ।',
    'गेट पास स्कॅन. शेतकऱ्याच्या फोनवरील क्यूआर कोडवर कॅमेरा धरा, किंवा खाली त्याचा सहा अंकी कोड भरा. योग्य टोकन दिसल्यावर प्रवेश द्या दाबा. यामुळे शेतकऱ्याची स्क्रीन लगेच बदलते आणि पुढील शेतकऱ्याला सूचना जाते.'
  ),
  audio_TodaysQueue: r(
    'आज की कतार। यहाँ आज के सभी टोकन क्रम में हैं, उनकी स्थिति के साथ। जो किसान समय पर नहीं आया उसे नो शो चिह्नित कर सकते हैं ताकि अगला किसान आगे बढ़े।',
    'Today\'s queue. All of today\'s tokens are listed in order with their status. If a farmer did not arrive on time, mark them No Show so the next farmer moves up.',
    'ਅੱਜ ਦੀ ਕਤਾਰ। ਇੱਥੇ ਅੱਜ ਦੇ ਸਾਰੇ ਟੋਕਨ ਕ੍ਰਮ ਵਿੱਚ ਹਨ, ਉਹਨਾਂ ਦੀ ਸਥਿਤੀ ਨਾਲ। ਜੋ ਕਿਸਾਨ ਸਮੇਂ ਤੇ ਨਹੀਂ ਆਇਆ ਉਸਨੂੰ ਨੋ ਸ਼ੋ ਲਗਾਓ ਤਾਂ ਜੋ ਅਗਲਾ ਕਿਸਾਨ ਅੱਗੇ ਵਧੇ।',
    'आजची रांग. येथे आजचे सर्व टोकन क्रमाने त्यांच्या स्थितीसह आहेत. जो शेतकरी वेळेवर आला नाही त्याला नो शो चिन्हांकित करा म्हणजे पुढील शेतकरी पुढे जाईल.'
  ),
  audio_StageQueue: r(
    'यह आपके चरण की कतार है। यहाँ वही टोकन दिखते हैं जिन पर अभी आपकी कार्रवाई बाकी है। किसी टोकन पर टैप करके उसका काम पूरा करें। काम होते ही वह अगले अधिकारी की सूची में चला जाता है।',
    'This is the queue for your stage. Only tokens waiting for your action appear here. Tap a token to complete its step. Once done, it moves to the next officer\'s list.',
    'ਇਹ ਤੁਹਾਡੇ ਪੜਾਅ ਦੀ ਕਤਾਰ ਹੈ। ਇੱਥੇ ਉਹੀ ਟੋਕਨ ਦਿਖਦੇ ਹਨ ਜਿਨ੍ਹਾਂ ਤੇ ਤੁਹਾਡੀ ਕਾਰਵਾਈ ਬਾਕੀ ਹੈ। ਟੋਕਨ ਤੇ ਟੈਪ ਕਰਕੇ ਕੰਮ ਪੂਰਾ ਕਰੋ। ਫਿਰ ਉਹ ਅਗਲੇ ਅਧਿਕਾਰੀ ਦੀ ਸੂਚੀ ਵਿੱਚ ਚਲਾ ਜਾਂਦਾ ਹੈ।',
    'ही तुमच्या टप्प्याची रांग आहे. येथे फक्त तेच टोकन दिसतात ज्यांवर तुमची कारवाई बाकी आहे. टोकनवर टॅप करून त्याचे काम पूर्ण करा. मग ते पुढील अधिकाऱ्याच्या यादीत जाते.'
  ),
  audio_Assay: r(
    'गुणवत्ता जांच। नमी प्रतिशत और बाहरी पदार्थ भरें, ग्रेड चुनें और ज़रूरत हो तो टिप्पणी लिखें। फिर जांच दर्ज करें दबाएं। भाव ग्रेड के अनुसार अपने आप तय होता है और किसान को तुरंत दिखता है। फसल स्वीकार योग्य न हो तो अस्वीकार करें दबाएं।',
    'Quality check. Enter moisture percentage and foreign matter, choose the grade and add notes if needed. Then tap Record Assay. The price is fixed automatically from the grade and shown to the farmer at once. If the lot is not acceptable, tap Reject.',
    'ਗੁਣਵੱਤਾ ਜਾਂਚ। ਨਮੀ ਪ੍ਰਤੀਸ਼ਤ ਅਤੇ ਬਾਹਰੀ ਪਦਾਰਥ ਭਰੋ, ਗ੍ਰੇਡ ਚੁਣੋ ਅਤੇ ਲੋੜ ਹੋਵੇ ਤਾਂ ਟਿੱਪਣੀ ਲਿਖੋ। ਫਿਰ ਜਾਂਚ ਦਰਜ ਕਰੋ ਦਬਾਓ। ਭਾਅ ਗ੍ਰੇਡ ਅਨੁਸਾਰ ਆਪਣੇ ਆਪ ਤੈਅ ਹੁੰਦਾ ਹੈ। ਫਸਲ ਠੀਕ ਨਾ ਹੋਵੇ ਤਾਂ ਅਸਵੀਕਾਰ ਕਰੋ ਦਬਾਓ।',
    'गुणवत्ता तपासणी. ओलावा टक्केवारी आणि परकीय पदार्थ भरा, ग्रेड निवडा आणि गरज असल्यास टिप्पणी लिहा. मग तपासणी नोंदवा दाबा. भाव ग्रेडनुसार आपोआप ठरतो आणि शेतकऱ्याला लगेच दिसतो. पीक स्वीकारण्यायोग्य नसेल तर नाकारा दाबा.'
  ),
  audio_Weighing: r(
    'तौल पेज। धर्मकांटे से आया कुल वजन क्विंटल में भरें। ज़रूरत हो तो वाहन का खाली वजन भी भरें। कुल राशि भाव और वजन से अपने आप बनती है। तौल दर्ज करें दबाते ही टोकन कैशियर के पास चला जाता है।',
    'Weighing page. Enter the total weight from the weighbridge in quintals. Enter the empty vehicle weight too if needed. The total amount is calculated from price and weight automatically. Tap Record Weighing and the token moves to the cashier.',
    'ਤੋਲ ਪੇਜ। ਧਰਮਕੰਡੇ ਤੋਂ ਆਇਆ ਕੁੱਲ ਵਜ਼ਨ ਕੁਇੰਟਲ ਵਿੱਚ ਭਰੋ। ਲੋੜ ਹੋਵੇ ਤਾਂ ਖਾਲੀ ਵਾਹਨ ਦਾ ਵਜ਼ਨ ਵੀ ਭਰੋ। ਕੁੱਲ ਰਕਮ ਭਾਅ ਅਤੇ ਵਜ਼ਨ ਤੋਂ ਆਪਣੇ ਆਪ ਬਣਦੀ ਹੈ। ਤੋਲ ਦਰਜ ਕਰੋ ਦਬਾਉਂਦੇ ਹੀ ਟੋਕਨ ਕੈਸ਼ੀਅਰ ਕੋਲ ਚਲਾ ਜਾਂਦਾ ਹੈ।',
    'वजन पेज. वजनकाट्यावरून आलेले एकूण वजन क्विंटलमध्ये भरा. गरज असल्यास रिकाम्या वाहनाचे वजन देखील भरा. एकूण रक्कम भाव आणि वजनावरून आपोआप तयार होते. वजन नोंदवा दाबताच टोकन कॅशियरकडे जाते.'
  ),
  audio_MarkPaid: r(
    'भुगतान पेज। किसान को देय राशि ऊपर है। भुगतान का तरीका चुनें, जैसे बैंक ट्रांसफर या यूपीआई, और संदर्भ नंबर भरें। भुगतान हो गया दबाते ही किसान को रसीद मिल जाती है और टोकन पूरा हो जाता है।',
    'Payment page. The amount due to the farmer is at the top. Choose the payment mode, such as bank transfer or UPI, and enter the reference number. Tap Mark Paid and the farmer gets the receipt instantly and the token is complete.',
    'ਭੁਗਤਾਨ ਪੇਜ। ਕਿਸਾਨ ਨੂੰ ਦੇਣ ਵਾਲੀ ਰਕਮ ਉੱਪਰ ਹੈ। ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ ਚੁਣੋ, ਜਿਵੇਂ ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ ਜਾਂ ਯੂਪੀਆਈ, ਅਤੇ ਹਵਾਲਾ ਨੰਬਰ ਭਰੋ। ਭੁਗਤਾਨ ਹੋ ਗਿਆ ਦਬਾਉਂਦੇ ਹੀ ਕਿਸਾਨ ਨੂੰ ਰਸੀਦ ਮਿਲ ਜਾਂਦੀ ਹੈ।',
    'पेमेंट पेज. शेतकऱ्याला देय रक्कम वर आहे. पेमेंटची पद्धत निवडा, जसे बँक ट्रान्सफर किंवा यूपीआय, आणि संदर्भ क्रमांक भरा. पेमेंट झाले दाबताच शेतकऱ्याला पावती मिळते आणि टोकन पूर्ण होते.'
  ),
  audio_Reports: r(
    'दैनिक रिपोर्ट। आज की मंडी का सार, कुल टोकन, प्रवेश, जांच, तौल, भुगतान और कुल राशि। फसल के अनुसार आवक भी नीचे है। यह रिपोर्ट साझा भी कर सकते हैं।',
    'Daily report. A summary of today\'s mandi: total tokens, entries, assays, weighings, payments and total amount. Arrivals by crop are below. You can share this report.',
    'ਰੋਜ਼ਾਨਾ ਰਿਪੋਰਟ। ਅੱਜ ਦੀ ਮੰਡੀ ਦਾ ਸਾਰ, ਕੁੱਲ ਟੋਕਨ, ਐਂਟਰੀ, ਜਾਂਚ, ਤੋਲ, ਭੁਗਤਾਨ ਅਤੇ ਕੁੱਲ ਰਕਮ। ਫਸਲ ਅਨੁਸਾਰ ਆਮਦ ਵੀ ਹੇਠਾਂ ਹੈ। ਇਹ ਰਿਪੋਰਟ ਸਾਂਝੀ ਵੀ ਕਰ ਸਕਦੇ ਹੋ।',
    'दैनिक अहवाल. आजच्या मंडीचा सारांश: एकूण टोकन, प्रवेश, तपासणी, वजन, पेमेंट आणि एकूण रक्कम. पिकानुसार आवक खाली आहे. हा अहवाल शेअर करू शकता.'
  ),
  audio_DelayReport: r(
    'देरी की सूचना। अगर मंडी में काम धीमा चल रहा है, तो कितने मिनट की देरी है और कारण चुनकर भेजें। इससे सभी प्रतीक्षारत किसानों का अनुमानित समय अपने आप आगे बढ़ जाता है।',
    'Delay report. If work at the mandi is running slow, choose how many minutes of delay and the reason, then submit. Every waiting farmer\'s expected time is pushed forward automatically.',
    'ਦੇਰੀ ਦੀ ਸੂਚਨਾ। ਜੇ ਮੰਡੀ ਵਿੱਚ ਕੰਮ ਹੌਲੀ ਚੱਲ ਰਿਹਾ ਹੈ ਤਾਂ ਕਿੰਨੇ ਮਿੰਟ ਦੀ ਦੇਰੀ ਹੈ ਅਤੇ ਕਾਰਨ ਚੁਣ ਕੇ ਭੇਜੋ। ਇਸ ਨਾਲ ਸਾਰੇ ਉਡੀਕ ਰਹੇ ਕਿਸਾਨਾਂ ਦਾ ਅਨੁਮਾਨਿਤ ਸਮਾਂ ਆਪਣੇ ਆਪ ਅੱਗੇ ਵਧ ਜਾਂਦਾ ਹੈ।',
    'विलंब सूचना. मंडीत काम हळू चालत असेल तर किती मिनिटांचा विलंब आणि कारण निवडून पाठवा. यामुळे सर्व प्रतीक्षेत असलेल्या शेतकऱ्यांची अपेक्षित वेळ आपोआप पुढे जाते.'
  ),
  audio_OfficerProfile: r(
    'अधिकारी प्रोफ़ाइल। यहाँ आपका नाम, मंडी, ड्यूटी और कर्मचारी आईडी है। ड्यूटी बदलने के लिए मंडी प्रशासक कोड चाहिए। नीचे से लॉगआउट कर सकते हैं।',
    'Officer profile. Your name, mandi, duty and employee ID are here. Changing duty needs the mandi admin code. You can log out at the bottom.',
    'ਅਧਿਕਾਰੀ ਪ੍ਰੋਫ਼ਾਈਲ। ਇੱਥੇ ਤੁਹਾਡਾ ਨਾਮ, ਮੰਡੀ, ਡਿਊਟੀ ਅਤੇ ਕਰਮਚਾਰੀ ਆਈਡੀ ਹੈ। ਡਿਊਟੀ ਬਦਲਣ ਲਈ ਮੰਡੀ ਪ੍ਰਸ਼ਾਸਕ ਕੋਡ ਚਾਹੀਦਾ ਹੈ। ਹੇਠਾਂ ਤੋਂ ਲੌਗਆਊਟ ਕਰ ਸਕਦੇ ਹੋ।',
    'अधिकारी प्रोफाइल. येथे तुमचे नाव, मंडी, ड्युटी आणि कर्मचारी आयडी आहे. ड्युटी बदलण्यासाठी मंडी प्रशासक कोड लागतो. खालून लॉगआउट करू शकता.'
  ),
  audio_TraderDashboard: r(
    'व्यापारी पेज। नीलामी बोर्ड में आज के जांचे हुए लॉट हैं जिन पर बोली लगा सकते हैं। मेरी खरीद में आपके जीते हुए लॉट और उनका तौल व भुगतान है। ऊपर अवतार से प्रोफ़ाइल और लॉगआउट।',
    'Trader page. The auction board shows today\'s assayed lots you can bid on. My Purchases shows the lots you won with their weighing and payment. Tap the avatar at the top for profile and logout.',
    'ਵਪਾਰੀ ਪੇਜ। ਨੀਲਾਮੀ ਬੋਰਡ ਵਿੱਚ ਅੱਜ ਦੇ ਜਾਂਚੇ ਹੋਏ ਲਾਟ ਹਨ ਜਿਨ੍ਹਾਂ ਤੇ ਬੋਲੀ ਲਗਾ ਸਕਦੇ ਹੋ। ਮੇਰੀ ਖਰੀਦ ਵਿੱਚ ਜਿੱਤੇ ਹੋਏ ਲਾਟ ਅਤੇ ਉਹਨਾਂ ਦਾ ਤੋਲ ਤੇ ਭੁਗਤਾਨ ਹੈ। ਉੱਪਰ ਅਵਤਾਰ ਤੋਂ ਪ੍ਰੋਫ਼ਾਈਲ ਅਤੇ ਲੌਗਆਊਟ।',
    'व्यापारी पेज. लिलाव बोर्डवर आजचे तपासलेले लॉट आहेत ज्यांवर बोली लावू शकता. माझी खरेदी मध्ये जिंकलेले लॉट व त्यांचे वजन आणि पेमेंट आहे. वर अवतारवरून प्रोफाइल आणि लॉगआउट.'
  ),
  audio_AuctionBoard: r(
    'नीलामी बोर्ड। हर कार्ड एक लॉट है, फसल, ग्रेड, मात्रा और अभी की सबसे ऊँची बोली के साथ। समय खत्म होने से पहले बोली लगाने के लिए लॉट पर टैप करें।',
    'Auction board. Each card is one lot with crop, grade, quantity and the current highest bid. Tap a lot to bid before its timer ends.',
    'ਨੀਲਾਮੀ ਬੋਰਡ। ਹਰ ਕਾਰਡ ਇੱਕ ਲਾਟ ਹੈ, ਫਸਲ, ਗ੍ਰੇਡ, ਮਾਤਰਾ ਅਤੇ ਹੁਣ ਦੀ ਸਭ ਤੋਂ ਉੱਚੀ ਬੋਲੀ ਨਾਲ। ਸਮਾਂ ਖਤਮ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਬੋਲੀ ਲਈ ਲਾਟ ਤੇ ਟੈਪ ਕਰੋ।',
    'लिलाव बोर्ड. प्रत्येक कार्ड एक लॉट आहे: पीक, ग्रेड, प्रमाण आणि सध्याची सर्वोच्च बोली. वेळ संपण्यापूर्वी बोली लावण्यासाठी लॉटवर टॅप करा.'
  ),
  audio_AuctionBidding: r(
    'बोली पेज। ऊपर लॉट का विवरण और न्यूनतम भाव है। अपनी बोली प्रति क्विंटल भरें और बोली लगाएं दबाएं। बोली न्यूनतम से ऊपर होनी चाहिए। समय खत्म होने पर सबसे ऊँची बोली जीतती है।',
    'Bidding page. Lot details and the minimum price are at the top. Enter your bid per quintal and tap Place Bid. The bid must be above the minimum. When the timer ends, the highest bid wins.',
    'ਬੋਲੀ ਪੇਜ। ਉੱਪਰ ਲਾਟ ਦਾ ਵੇਰਵਾ ਅਤੇ ਘੱਟੋ-ਘੱਟ ਭਾਅ ਹੈ। ਆਪਣੀ ਬੋਲੀ ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਭਰੋ ਅਤੇ ਬੋਲੀ ਲਗਾਓ ਦਬਾਓ। ਬੋਲੀ ਘੱਟੋ-ਘੱਟ ਤੋਂ ਉੱਪਰ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ। ਸਮਾਂ ਖਤਮ ਹੋਣ ਤੇ ਸਭ ਤੋਂ ਉੱਚੀ ਬੋਲੀ ਜਿੱਤਦੀ ਹੈ।',
    'बोली पेज. वर लॉटचा तपशील आणि किमान भाव आहे. तुमची बोली प्रति क्विंटल भरा आणि बोली लावा दाबा. बोली किमानपेक्षा जास्त हवी. वेळ संपल्यावर सर्वोच्च बोली जिंकते.'
  ),
  audio_MyPurchases: r(
    'मेरी खरीद। यहाँ आपके जीते हुए लॉट हैं। हर लॉट का तौला हुआ वजन और कुल राशि तौल के बाद यहाँ दिखती है, और भुगतान की स्थिति भी।',
    'My purchases. The lots you won are here. Each lot\'s weighed quantity and total amount appear after weighing, along with the payment status.',
    'ਮੇਰੀ ਖਰੀਦ। ਇੱਥੇ ਤੁਹਾਡੇ ਜਿੱਤੇ ਹੋਏ ਲਾਟ ਹਨ। ਹਰ ਲਾਟ ਦਾ ਤੋਲਿਆ ਹੋਇਆ ਵਜ਼ਨ ਅਤੇ ਕੁੱਲ ਰਕਮ ਤੋਲ ਤੋਂ ਬਾਅਦ ਇੱਥੇ ਦਿਖਦੀ ਹੈ, ਅਤੇ ਭੁਗਤਾਨ ਦੀ ਸਥਿਤੀ ਵੀ।',
    'माझी खरेदी. येथे तुम्ही जिंकलेले लॉट आहेत. प्रत्येक लॉटचे वजन केलेले प्रमाण आणि एकूण रक्कम वजनानंतर येथे दिसते, आणि पेमेंटची स्थिती देखील.'
  ),
  audio_TraderProfile: r(
    'व्यापारी प्रोफ़ाइल। यहाँ आपका नाम, मोबाइल और मंडी है। मंडी बदल सकते हैं। नीचे से लॉगआउट करें।',
    'Trader profile. Your name, mobile and mandi are here. You can change your mandi. Log out at the bottom.',
    'ਵਪਾਰੀ ਪ੍ਰੋਫ਼ਾਈਲ। ਇੱਥੇ ਤੁਹਾਡਾ ਨਾਮ, ਮੋਬਾਈਲ ਅਤੇ ਮੰਡੀ ਹੈ। ਮੰਡੀ ਬਦਲ ਸਕਦੇ ਹੋ। ਹੇਠਾਂ ਤੋਂ ਲੌਗਆਊਟ ਕਰੋ।',
    'व्यापारी प्रोफाइल. येथे तुमचे नाव, मोबाईल आणि मंडी आहे. मंडी बदलू शकता. खालून लॉगआउट करा.'
  ),
};

/* ------------------------------------------------------------------ */
/*  translate()                                                        */
/* ------------------------------------------------------------------ */

function fill(text, params, lang) {
  // Params that are IDs (crop, grade) are shown in the reader's language.
  if (params && typeof params === 'object') {
    const p = { ...params };
    if (p.crop != null && t[`crop_${p.crop}`]) p.crop = (t[`crop_${p.crop}`][lang] || t[`crop_${p.crop}`].hi);
    if (p.grade != null && t[`grade_${p.grade}`]) p.grade = (t[`grade_${p.grade}`][lang] || t[`grade_${p.grade}`].hi);
    if (p.mandi != null && lang === 'en') { const mm = /\(([^)]+)\)/.exec(String(p.mandi)); if (mm) p.mandi = mm[1]; }
    params = p;
  }
  if (!params) return text;
  return String(text).replace(/\{(\w+)\}/g, (m, k) => {
    const v = params[k];
    if (v === undefined || v === null) return '';
    // A param can itself be a translatable { key, params } object
    // (e.g. buyer = { key: 'td_govBuyer' } coming from services).
    if (typeof v === 'object' && v.key) return translate(v.key, lang, v.params);
    return String(v);
  });
}

/**
 * translate('key', 'hi', { n: 3 })
 * Unknown key -> the key itself (so it is visible during testing).
 */
export function translate(key, lang = DEFAULT_LANG, params) {
  const row = t[key];
  if (!row) return fill(String(key || ''), params, lang);
  const text = row[lang] || row.hi || row.en || '';
  return fill(text, params, lang);
}

/** Does a translation key exist? (used by AppHeader for per-screen voice help) */
export function hasKey(key) {
  return !!t[key];
}

/** Crop display name in a language. */
export function cropName(cropId, lang = DEFAULT_LANG) {
  return translate(`crop_${cropId}`, lang);
}

/** Grade display name. */
export function gradeName(gradeId, lang = DEFAULT_LANG) {
  return translate(`grade_${gradeId}`, lang);
}

/**
 * Mandi name: centres store `name` (Hindi + English in brackets) and
 * optionally `name_en`. English users get the English form.
 */
export function centreName(centre, lang = DEFAULT_LANG) {
  if (!centre) return '';
  if (lang === 'en' && centre.name_en) return centre.name_en;
  if (lang === 'en') {
    const m = /\(([^)]+)\)/.exec(centre.name || '');
    if (m) return m[1];
  }
  return centre.name || '';
}
