export const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
];

export const t = {
  // Brand
  brand: { hi: 'AGROBRIDGE', en: 'AGROBRIDGE', pa: 'AGROBRIDGE', mr: 'AGROBRIDGE', gu: 'AGROBRIDGE' },
  brandSub: { hi: 'किसानसेतु - डिजिटल मंडी खरीद', en: 'KisanSetu - Smart Procurement', pa: 'ਕਿਸਾਨਸੇਤੁ - ਸਮਾਰਟ ਮੰਡੀ', mr: 'किसानसेतु - स्मार्ट खरेदी', gu: 'કિસਾਨસેતુ - સ્માર્ટ મંડી' },
  smartPlatform: { hi: 'स्मार्ट खरीद प्लेटफॉर्म', en: 'Smart Procurement Platform', pa: 'ਸਮਾਰਟ ਖਰੀਦ ਪਲੇਟਫਾਰਮ', mr: 'स्मार्ट खरेदी प्लॅਟफॉर्म', gu: 'સ્માર્ટ ખરીદ પ્લેટફોર્મ' },

  // Navigation & Actions
  getStarted: { hi: 'शुरू करें', en: 'Get Started', pa: 'ਸ਼ੁਰੂ ਕਰੋ', mr: 'सुरू करा', gu: 'શરૂ કરો' },
  continue: { hi: 'आगे बढ़ें', en: 'Continue', pa: 'ਅੱਗੇ ਵਧੋ', mr: 'पुढे जा', gu: 'આગળ વધો' },
  back: { hi: 'वापस', en: 'Back', pa: 'ਵਾਪਸ', mr: 'मागे', gu: 'પાછળ' },
  logout: { hi: 'लॉग आउट', en: 'Log Out', pa: 'ਲੋਗ ਆਉਟ', mr: 'लॉग आउट', gu: 'લૉગ ਆਉਟ' },
  cancel: { hi: 'रद्द करें', en: 'Cancel', pa: 'ਰੱਦ ਕਰੋ', mr: 'रद्द करा', gu: 'રદ કરો' },
  confirm: { hi: 'पुष्टि करें', en: 'Confirm', pa: 'ਪੁਸ਼ਟੀ ਕਰੋ', mr: 'पुष्टी करा', gu: 'પુષ્ટિ કરો' },
  login: { hi: 'लॉग इन', en: 'Login', pa: 'ਲਾਗਇਨ', mr: 'लॉगिन', gu: 'લૉગિન' },
  register: { hi: 'नया खाता बनाएं', en: 'Create Account', pa: 'ਨਵਾਂ ਖਾਤਾ', mr: 'नवीन खाते', gu: 'નવું ખાતું' },
  sendOtp: { hi: 'ओटीपी भेजें', en: 'Send OTP', pa: 'OTP ਭੇਜੋ', mr: 'OTP पाठवा', gu: 'OTP મોકલો' },
  verifyOtp: { hi: 'सत्यापित करें', en: 'Verify & Proceed', pa: 'ਪੁਸ਼ਟੀ ਕਰੋ', mr: 'सत्यापित करा', gu: 'ચકાસો' },

  // Role Selection (3 Roles: Farmer, Mandi Officer, Trader)
  selectRole: { hi: 'अपनी भूमिका चुनें', en: 'Select Your Role', pa: 'ਭੂਮਿਕਾ ਚੁਣੋ', mr: 'भूमिका निवडा', gu: 'ભૂમિકા પસંદ કરો' },
  roleFarmer: { hi: 'किसान', en: 'Farmer', pa: 'ਕਿਸਾਨ', mr: 'शेतकरी', gu: 'ખેડૂત' },
  roleFarmerSub: { hi: 'गेट स्लॉट बुक करें, कतार टोकन देखें और बैंक रसीद पाएं', en: 'Book gate slots, track queue tokens & bank receipts', pa: 'ਸਲਾਟ ਬੁੱਕ ਕਰੋ, ਟੋਕਨ ਅਤੇ ਰਸੀਦ ਵੇਖੋ', mr: 'स्लॉट बुक करा, टोकन व पावती पहा', gu: 'સ્લોટ બુક કરો, ટોકન અને રસીદ જુઓ' },
  roleOfficer: { hi: 'मंडी अधिकारी / स्टाफ', en: 'Mandi Officer / Staff', pa: 'ਮੰਡੀ ਅਧਿਕਾਰੀ', mr: 'मंडी अधिकारी', gu: 'મંડી અધિકારી' },
  roleOfficerSub: { hi: 'गेट प्रवेश, तौल, ग्रेडिंग और भुगतान प्रबंधन', en: 'Manage gate entries, weighment, grading & payouts', pa: 'ਗੇਟ ਆਮਦ, ਤੋਲ ਅਤੇ ਭੁਗਤਾਨ ਪ੍ਰਬੰਧਿਤ ਕਰੋ', mr: 'गेट आगमन, वजन आणि पेमेंट व्यवस्थापित करा', gu: 'ગેટ આગમન, વજન અને ચુકવણી મેનેજ કરો' },
  roleTrader: { hi: 'व्यापारी / आढ़तिया', en: 'Trader / Buyer', pa: 'ਵਪਾਰੀ', mr: 'व्यापारी / खरेदीदार', gu: 'વેપારી' },
  roleTraderSub: { hi: 'नीलामी में बोली लगाएं और खरीदी गई फसल की रसीदें देखें', en: 'Participate in crop bidding auctions & track lots', pa: 'ਨੀਲਾਮੀ ਵਿੱਚ ਬੋਲੀ ਲਗਾਓ', mr: 'लिलावात बोली लावा', gu: 'હરાજીમાં બોલી લગાવો' },

  // Dashboards
  namaste: { hi: 'नमस्ते', en: 'Namaste', pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', mr: 'नमस्कार', gu: 'નમસ્ਤੇ' },
  noActiveBooking: { hi: 'कोई सक्रिय बुकिंग नहीं', en: 'No Active Booking', pa: 'ਕੋਈ ਬੁਕਿੰਗ ਨਹੀਂ', mr: 'सक्रिय बुकिंग नाही', gu: 'કોઈ સક્રિય બુકિંગ નથી' },
  noActiveBookingSub: { hi: 'मंडी में बिना इंतजार एंट्री के लिए अभी गेट स्लॉट बुक करें', en: 'Book a gate slot now for zero waiting mandi entry', pa: 'ਮੰਡੀ ਜਾਣ ਲਈ ਹੁਣੇ ਸਲਾਟ ਬੁੱਕ ਕਰੋ', mr: 'मंडीत जाण्यासाठी आता स्लॉट बुक करा', gu: 'મંડી જવા માટે અત્યારે સ્લોਟ બુક કરો' },
  bookASlot: { hi: 'स्लॉट बुक करें →', en: 'Book a slot →', pa: 'ਸਲਾਟ ਬੁੱਕ ਕਰੋ →', mr: 'स्लॉट बुक करा →', gu: 'સ્લોਟ બુક કરો →' },
  bookSlot: { hi: 'स्लॉट बुक करें', en: 'Book Slot', pa: 'ਸਲਾਟ ਬੁੱਕ', mr: 'ਸਲਾਟ ਬੁੱਕ', gu: 'સ્લોਟ બુક' },
  myToken: { hi: 'मेरा टोकन', en: 'My Token', pa: 'ਮੇਰਾ ਟੋਕਨ', mr: 'माझे टोकन', gu: 'મારું ટોਕન' },
  payments: { hi: 'भुगतान व रसीद', en: 'Payments & Receipts', pa: 'ਭੁਗਤਾਨ ਅਤੇ ਰਸੀਦ', mr: 'पेमेंट व पावती', gu: 'ચુકવણી અને રસીદ' },
  history: { hi: 'पुराना इतिहास', en: 'Booking History', pa: 'ਇਤਿਹਾਸ', mr: 'इतिहास', gu: 'ઇતિહાસ' },
  myCrops: { hi: 'मेरी फसलें', en: 'My Saved Crops', pa: 'ਮੇਰੀਆਂ ਫਸਲਾਂ', mr: 'माझी पिके', gu: 'મારા પાક' },
  help: { hi: 'सहायता केंद्र', en: 'Helpline & Support', pa: 'ਮਦਦ ਕੇਂਦਰ', mr: 'मदत केंद्र', gu: 'મદદ કેન્દ્ર' },
  activeBooking: { hi: 'सक्रिय बुकिंग', en: 'Active Booking', pa: 'ਸਰਗਰਮ ਬੁਕਿੰਗ', mr: 'सक्रिय बुकिंग', gu: 'સક્રિય બુકિંગ' },
  trackStatus: { hi: 'गेट स्थिति देखें', en: 'Track Gate Status', pa: 'ਗੇਟ ਹਾਲਤ ਵੇਖੋ', mr: 'गेट स्थिती पहा', gu: 'ગેટ સ્થિતિ' },
  vehiclesAhead: { hi: 'आगे वाहन', en: 'Vehicles Ahead', pa: 'ਅੱਗੇ ਵਾਹਨ', mr: 'पुढे वाहने', gu: 'આગળ વાહન' },
  estTurn: { hi: 'अनुमानित बारी', en: 'Est. Turn', pa: 'ਅਨੁਮਾਨਿਤ ਵਾਰੀ', mr: 'अंदाजे पाळी', gu: 'અંદાજਿਤ વારો' },

  // Booking Flow Steps
  selectCrop: { hi: 'चरण 1: फसल चुनें', en: 'Step 1: Select Crop', pa: 'ਪਗ 1: ਫਸਲ ਚੁਣੋ', mr: 'पायरी 1: पीक निवडा', gu: 'પગલું 1: પાક પસંદ કરો' },
  selectCropSub: { hi: 'आज मंडी में बेचने वाली फसल चुनें', en: 'Choose the crop you will sell at the mandi today', pa: 'ਅੱਜ ਮੰਡੀ ਵਿੱਚ ਵੇਚਣ ਵਾਲੀ ਫਸਲ ਚੁਣੋ', mr: 'आज मंडीत विकायचे पीक निवडा', gu: 'આજે મંડીમાં વેચવાનો પાક પસંદ કરો' },
  selectCentre: { hi: 'चरण 2: मंडी चुनें', en: 'Step 2: Select Mandi', pa: 'ਪਗ 2: ਮੰਡੀ ਚੁਣੋ', mr: 'पायरी 2: मंडी निवडा', gu: 'પગલું 2: મંડી' },
  selectCentreSub: { hi: 'अपनी फसल लेने वाला निकटतम एपीएमसी केंद्र चुनें', en: 'Pick the nearest APMC centre accepting your crop', pa: 'ਆਪਣੀ ਫਸਲ ਲੈਣ ਵਾਲੀ ਨਜ਼ਦੀਕੀ ਮੰਡੀ ਚੁਣੋ', mr: 'तुमचे पीक स्वीकारणारी जवळची मंडी निवडा', gu: 'તમારો પાક લે તેવી નજીકની મંડી પસંદ કરો' },
  selectSlot: { hi: 'चरण 3: आगमन समय', en: 'Step 3: Arrival Window', pa: 'ਪਗ 3: ਆਮਦ ਸਮਾਂ', mr: 'पायरी 3: आगमन वेळ', gu: 'પગલું 3: આગમન સમય' },
  selectSlotSub: { hi: 'गेट पर पहुँचने की तारीख और समय चुनें', en: 'Choose date and time window to arrive at the gate', pa: 'ਗੇਟ ਤੇ ਪਹੁੰਚਣ ਦੀ ਤਾਰੀਖ ਅਤੇ ਸਮਾਂ ਚੁਣੋ', mr: 'गेटवर येण्याची तारीख व वेळ निवडा', gu: 'ગેટ પર આવવાની તારીખ અને સમય પસંદ કરો' },
  nearest: { hi: 'निकटतम', en: 'Nearest', pa: 'ਨਜ਼ਦੀਕੀ', mr: 'जवळचे', gu: 'નજીક' },
  available: { hi: 'उपलब्ध', en: 'AVAILABLE', pa: 'ਉਪਲਬਧ', mr: 'उपलब्ध', gu: 'ઉપલબ્ਧ' },
  waitlist: { hi: 'प्रतीक्षा सूची', en: 'WAITLIST', pa: 'ਉਡੀਕ ਸੂਚੀ', mr: 'प्रतीक्षा यादी', gu: 'રાહ યાદી' },
  confirmToken: { hi: 'पुष्टि करें और टोकन लें', en: 'Confirm & Get Gate Token', pa: 'ਪੁਸ਼ਟੀ ਕਰੋ ਅਤੇ ਟੋਕਨ ਲਓ', mr: 'पुष्टी करा आणि टोकन घ्या', gu: 'પુષ્ટિ કરો અને ટોકન લો' },
  tokenGenerated: { hi: 'गेट टोकन जनरेट हुआ', en: 'Gate Token Generated', pa: 'ਗੇਟ ਟੋਕਨ ਬਣ ਗਿਆ', mr: 'गेट टोकन तयार', gu: 'ગેટ ટોકન બન્યું' },
  goDashboard: { hi: 'डैशबोर्ड पर जाएं', en: 'Go to Dashboard', pa: 'ਡੈਸ਼ਬੋਰਡ', mr: 'डॅशबोर्ड', gu: 'ਡેશਬੋਰਡ' },
  recordedAtGate: { hi: 'गेट प्रवेश पर दर्ज किया जाएगा', en: 'Will be recorded at gate entry', pa: 'ਗੇਟ ਤੇ ਦਰਜ ਹੋਵੇਗਾ', mr: 'गेटवर नोंद होईल', gu: 'ગેટ પર નોંધાશે' },

  // Officer / Queue
  gateQueue: { hi: 'आज की गेट कतार', en: "Today's Gate Queue", pa: 'ਅੱਜ ਦੀ ਗੇਟ ਕਤਾਰ', mr: 'आजची गेट रांग', gu: 'આજની ગેટ કતਾਰ' },
  markArrived: { hi: 'आगमन दर्ज करें', en: 'Mark Arrived', pa: 'ਆਮਦ ਦਰਜ ਕਰੋ', mr: 'आगमन नोंदवा', gu: 'આગમન નોંધો' },
  markNoShow: { hi: 'अनुपस्थित', en: 'No Show', pa: 'ਗੈਰਹਾਜ਼ਰ', mr: 'गैरहजर', gu: 'ગેરਹਾજર' },
  processPayment: { hi: 'भुगतान रसीद जनरेट करें', en: 'Process Payment & Receipt', pa: 'ਭੁਗਤਾਨ ਪ੍ਰਕਿਰਿਆ', mr: 'पेमेंट प्रक्रिया', gu: 'ચુકવણી પ્રક્રિયા' },
  enterVehicle: { hi: 'वाहन नंबर दर्ज करें', en: 'Enter Vehicle Plate Number', pa: 'ਵਾਹਨ ਨੰਬਰ ਦਰਜ ਕਰੋ', mr: 'वाहन क्रमांक टाका', gu: 'વાહન નંબર નાખો' },
  confirmArrival: { hi: 'आगमन पुष्टि करें', en: 'Confirm Gate Arrival', pa: 'ਆਮਦ ਪੁਸ਼ਟੀ', mr: 'आगमन पुष्टी', gu: 'આગਮન પુષ્ટિ' },

  // Spoken Voice Guidance Scripts (Conversational help for low-literacy users)
  audio_welcome: {
    hi: 'एग्रोब्रिज किसान सेतु में आपका स्वागत है। यह ऐप किसानों को मंडी गेट स्लॉट बुक करने और घंटों के इंतजार से बचाने के लिए बनाया गया है। आगे बढ़ने के लिए नीचे दिए गए नारंगी बटन पर टैप करें।',
    en: 'Welcome to Agrobridge KisanSetu. This app helps farmers book mandi gate slots to avoid long waiting lines. Tap Get Started to continue.',
    pa: 'ਐਗਰੋਬ੍ਰਿਜ ਕਿਸਾਨ ਸੇਤੁ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ। ਇਹ ਐਪ ਮੰਡੀ ਵਿੱਚ ਬਿਨਾਂ ਉਡੀਕ ਫਸਲ ਵੇਚਣ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ। ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਬਟਨ ਦਬਾਓ।',
    mr: 'अॅग्रोब्रिज किसान सेतु मध्ये स्वागत. मंडीत विना प्रतीक्षा पीक विकण्यासाठी सुरू करा बटण दाबा.',
    gu: 'એગ્રોબ્રિજ કિસાન સેતુમાં સ્વાગત. મંડીમાં વિના રાહ જોયે પાક વેચવા શરૂ કરો બਟન દબાવો.'
  },
  audio_role: {
    hi: 'अपनी भूमिका चुनें। यदि आप फसल बेचने वाले किसान हैं, तो किसान चुनें। यदि आप मंडी में गेट, तौल या खाता संभालते हैं, तो मंडी अधिकारी चुनें। यदि आप फसल खरीदने वाले व्यापारी हैं, तो व्यापारी चुनें।',
    en: 'Select your role. If you are a farmer, tap Farmer. If you work at the mandi, tap Mandi Officer. If you are a crop buyer, tap Trader.',
    pa: 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ। ਕਿਸਾਨ, ਮੰਡੀ ਅਧਿਕਾਰੀ ਜਾਂ ਵਪਾਰੀ ਵਿੱਚੋਂ ਇੱਕ ਚੁਣੋ।',
    mr: 'तुमची भूमिका निवडा. शेतकरी, मंडी अधिकारी किंवा व्यापारी.',
    gu: 'તમારી ભૂમિકા પસંદ કરો. ખેડૂત, મંડી અધિકારી અથવા વેપારી.'
  },
  audio_farmer_dashboard: {
    hi: 'यह आपका मुख्य किसान पेज है। मंडी जाने के लिए स्लॉट बुक करें बटन पर टैप करें। अपनी सक्रिय टोकन स्थिति, वाहन कतार और संभावित समय आप ऊपर देख सकते हैं। किसी भी सहायता के लिए हेल्प बटन दबाएं।',
    en: 'This is your farmer home page. Tap Book Slot to select a mandi and arrival window. Your active token status and live queue ETA are shown at the top.',
    pa: 'ਇਹ ਤੁਹਾਡਾ ਹੋਮ ਪੇਜ ਹੈ। ਮੰਡੀ ਜਾਣ ਲਈ ਸਲਾਟ ਬੁੱਕ ਦਬਾਓ। ਆਪਣਾ ਟੋਕਨ ਅਤੇ ਲਾਈਵ ਕਤਾਰ ਉੱਪਰ ਵੇਖੋ।',
    mr: 'हे तुमचे होम पेज आहे. मंडीत जाण्यासाठी स्लॉट बुक करा. टोकन व रांग वर दिसेल.',
    gu: 'આ તમારું હોમ પેજ છે. મંડી જવા માટે સ્લોਟ બુક દબાવો. ટોકન અને લાઈવ કતાર ઉપર જુઓ.'
  },
  audio_crop: {
    hi: 'पहला चरण। वह फसल चुनें जिसे आप आज मंडी में बेचने जा रहे हैं। फसल कार्ड चुनने के बाद नीचे आगे बढ़ें बटन पर टैप करें।',
    en: 'Step one. Select the crop you will bring to the mandi today. Tap a crop card and then tap continue below.',
    pa: 'ਪਹਿਲਾ ਪਗ। ਜੋ ਫਸਲ ਵੇਚਣੀ ਹੈ ਉਸਨੂੰ ਚੁਣੋ ਅਤੇ ਹੇਠਾਂ ਅੱਗੇ ਵਧੋ ਦਬਾਓ।',
    mr: 'पायरी एक. विकायचे पीक निवडा आणि पुढे जा बटण दाबा.',
    gu: 'પગલું એક. વેચવાનો પાક પસંદ કરો અને આગળ વધો દબાવો.'
  },
  audio_centre: {
    hi: 'दूसरा चरण। अपनी निकटतम मंडी चुनें। सबसे पास की मंडी अपने आप ऊपर चिन्हित की गई है। अपनी पसंद का केंद्र चुनें और समय चुनने के लिए बटन दबाएं।',
    en: 'Step two. Select your preferred APMC Mandi centre. The nearest centre is auto-highlighted based on your location.',
    pa: 'ਦੂਜਾ ਪਗ। ਆਪਣੀ ਨਜ਼ਦੀਕੀ ਮੰਡੀ ਚੁਣੋ। ਸਭ ਤੋਂ ਨੇੜਲੀ ਮੰਡੀ ਉੱਪਰ ਦਿਖਾਈ ਗਈ ਹੈ।',
    mr: 'पायरी दोन. जवळची मंडी निवडा. सर्वात जवळची मंडी वर हायलाइट केली आहे.',
    gu: 'પગલું બે. નજીકની મંડી પસંદ કરો. સૌથી નજીકની મંડી ઉપર દર્શાવેલ છે.'
  },
  audio_slot: {
    hi: 'तीसरा चरण। अपनी सुविधा अनुसार आगमन की तारीख और समय चुनें। हरे रंग के स्लॉट तुरंत उपलब्ध हैं। भरे स्लॉट पर आप प्रतीक्षा सूची का टोकन ले सकते हैं।',
    en: 'Step three. Choose your preferred arrival date and time window. Green slots are available. Red slots offer a waitlist ticket.',
    pa: 'ਤੀਜਾ ਪਗ। ਆਮਦ ਦੀ ਤਾਰੀਖ ਅਤੇ ਸਮਾਂ ਚੁਣੋ।',
    mr: 'पायरी तीन. येण्याची तारीख व वेळ निवडा.',
    gu: 'પગલું ત્રણ. આગમનની તારીખ અને સમય પસંદ કરો.'
  },
  audio_officer_queue: {
    hi: 'मंडी गेट कतार। जब किसान का वाहन गेट पर पहुंचे, तो आगमन दर्ज करें बटन दबाएं और वाहन नंबर लिखें। इसके बाद तौल और दर दर्ज करके रसीद जनरेट करें।',
    en: 'Mandi Gate Queue. When a farmer vehicle arrives, tap Mark Arrived and log the vehicle plate number.',
    pa: 'ਮੰਡੀ ਗੇਟ ਕਤਾਰ। ਕਿਸਾਨ ਦੇ ਆਉਣ ਤੇ ਆਮਦ ਦਰਜ ਕਰੋ ਅਤੇ ਵਾਹਨ ਨੰਬਰ ਲਿਖੋ।',
    mr: 'मंडी गेट रांग. शेतकरी आल्यावर आगमन नोंदवा आणि वाहन क्रमांक टाका.',
    gu: 'મંਡੀ ગેટ કતਾਰ. ખેડૂત આવે ત્યારે આગમન નોંધો અને વાહન નંબર લખો.'
  }
};

export function translate(key, lang = 'hi') {
  const row = t[key];
  if (!row) return '';
  return row[lang] || row.hi || row.en || '';
}