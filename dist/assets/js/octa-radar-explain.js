/* ══════════════════════════════════════════════════════════════
   🗣️ OCTA Smart Money Radar — طبقة الشرح
   ──────────────────────────────────────────────────────────────
   📌 **قوالب ثابتة** — مافيش أي ذكاء اصطناعي بيتخترع كلام.
      كل جملة معروفة مسبقاً ومتولّدة من أرقام حقيقية.

   📌 العربي هو الأساس · الإنجليزي مدعوم بالكامل.

   📌 كل مصطلح تقني ليه ٤ أجزاء:
      ① ما الذي يقيسه  ② ليه يهمّك  ③ إزاي OCTA بيستخدمه
      ④ ما الذي **لا** يعنيه

   ⛔ ممنوع: أي اسم أداة ذكاء اصطناعي في الكود أو التعليقات.
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OCTA_RADAR_EXPLAIN = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
   📖 المعجم — كل مصطلح تقني
   ══════════════════════════════════════════════════════════════ */
  var TERMS = {
    trend: {
      ar: {
        what: 'اتجاه حركة السعر: صاعد ولا هابط ولا عرضي.',
        why: 'أغلب استراتيجيات متابعة الاتجاه بتفضل مع الاتجاه، لا عكسه.',
        how: 'OCTA يقارن المتوسطات المتحركة (EMA20/50/200) بالسعر، ويفحص بنية القمم والأرض، ويقيس قوة الاتجاه بـ ADX.',
        not: 'الاتجاه الصاعد مش معناه إن السهم هيرتفع. والاتجاه مش ضمان.'
      },
      en: {
        what: 'The direction of price movement: up, down, or sideways.',
        why: 'Most trend-following strategies work better with the trend than against it.',
        how: 'OCTA compares moving averages (EMA20/50/200) with price, checks swing structure, and measures strength with ADX.',
        not: 'An uptrend does not mean the stock will rise. A trend is not a guarantee.'
      }
    },
    momentum: {
      ar: {
        what: 'قوة وسرعة الحركة الحالية، وهل بتتقوى ولا بتضعف.',
        why: 'الحركة بتميل تكمل، والزخم اللي بيضعف بيسبق التغيّر.',
        how: 'OCTA يقرأ RSI (14) و MACD (12/26/9) واتجاه ميل الـRSI، ويجمعهم في درجة زخم.',
        not: 'الزخم القوي مش معناه إن في أوامر شراء. هو بيصف الحالة الحالية بس.'
      },
      en: {
        what: 'The strength and speed of the current move, and whether it is building or fading.',
        why: 'Moves tend to continue, and fading momentum often precedes a change.',
        how: 'OCTA reads RSI (14), MACD (12/26/9) and the RSI slope, then combines them into a momentum score.',
        not: 'Strong momentum is not a buy signal. It describes the current condition only.'
      }
    },
    rsi: {
      ar: {
        what: 'مقياس من ٠ لـ ١٠٠ لقوة الصعود مقابل الهبوط في آخر ١٤ جلسة.',
        why: 'بيوضّح لو السهم في منطقة تشبع شرائي أو بيعي.',
        how: 'OCTA يحسبه بطريقة Wilder ويستخدمه في درجة الزخم وفي تمييز حالة التشبع.',
        not: 'تشبع شرائي (فوق ٧٠) مش معناه بيع، وتشبع بيعي (تحت ٣٠) مش معناه شراء. هو بيصف الشراء الحالي مش المستقبل.'
      },
      en: {
        what: 'A 0-100 gauge of buying strength versus selling strength over the last 14 sessions.',
        why: 'It shows whether the stock is in an overbought or oversold zone.',
        how: 'OCTA computes it with Wilder smoothing and uses it in the momentum score and the overbought/oversold state.',
        not: 'Overbought (above 70) does not mean sell, and oversold (below 30) does not mean buy. It describes current conditions, not the future.'
      }
    },
    macd: {
      ar: {
        what: 'الفرق بين متوسطين متحركين (١٢ و٢٦)، وخط إشارة من ٩ جلسات.',
        why: 'بيوضّح اتجاه الحركة وقوتها في نفس الوقت.',
        how: 'OCTA يقارن خط MACD بخط الإشارة ويطبّعه على ATR عشان المقارنة تكون منصفة بين الأسهم.',
        not: 'تقاطع MACD مش بيضمن حركة. هو بيصف الزخم مش السعر.'
      },
      en: {
        what: 'The difference between two moving averages (12 and 26), plus a 9-session signal line.',
        why: 'It shows the direction and strength of the move at the same time.',
        how: 'OCTA compares the MACD line to the signal line and normalizes it by ATR so stocks are compared fairly.',
        not: 'A MACD crossover does not guarantee a move. It describes momentum, not price.'
      }
    },
    rvol: {
      ar: {
        what: 'حجم اليوم مقسوماً على متوسط حجم ٢٠ جلسة سابقة.',
        why: 'الحركة المصحوبة بحجم participation أعلى أكثر مصداقية من حركة على حجم ضعيف.',
        how: 'OCTA يقارن الحجم بمتوسط **الجلسات السابقة** (مش من غير اليوم) ويصنّف النشاط.',
        not: 'حجم عالي **مش** شراء مؤسسات. ممكن يكون بيع أو توزيع أو ذعر أو نشاط مmaker.'
      },
      en: {
        what: "Today's volume divided by the average volume of the previous 20 sessions.",
        why: 'A move backed by higher participation is more credible than a move on thin volume.',
        how: 'OCTA compares volume against the **prior** sessions (not including today) and classifies the activity.',
        not: 'High volume is **not** institutional buying. It can be selling, distribution, panic, or market-maker activity.'
      }
    },
    atr: {
      ar: {
        what: 'متوسط مدى الحركة اليومية خلال آخر ١٤ جلسة.',
        why: 'بيقولك السهم بيتحرك قد إيه — وده أساس تحديد مسافة وقف الخسارة.',
        how: 'OCTA يحسب ATR بطريقة Wilder، ويستخدم ATR% مع ATR نسبي لتاريخ السهم نفسه في تحديد مسافة الوقف.',
        not: 'ATR **لا** يحدد اتجاه السهم، ولا يضمن إن وقف الخسارة هيمنع الخسارة.'
      },
      en: {
        what: 'The average daily trading range over the last 14 sessions.',
        why: 'It tells you how much the stock normally moves, which is the basis for stop distance.',
        how: 'OCTA computes Wilder ATR and uses both ATR% and ATR relative to the stock\'s own history to size the stop.',
        not: 'ATR does **not** determine direction, and it does not guarantee a stop will prevent loss.'
      }
    },
    adx: {
      ar: {
        what: 'قوة الاتجاه من ٠ لـ ١٠٠، بغض النظر عن اتجاهه.',
        why: 'بيفرق بين اتجاه واضح واتجاه ضعيف مش طويل.',
        how: 'OCTA يستخدم ADX كوزن مستقل في درجة الاتجاه (مع +DI/-DI لتحديد الاتجاه).',
        not: 'ADX عالي مش معناه إن السهم هيرتفع — بس إنه **مرتّب** في اتجاهه.'
      },
      en: {
        what: 'Trend strength from 0 to 100, regardless of direction.',
        why: 'It distinguishes a clear trend from a weak, choppy one.',
        how: 'OCTA uses ADX as a separate weighted component of the trend score, with +DI/-DI for direction.',
        not: 'A high ADX does not mean the stock will rise — only that it is **clean** in its direction.'
      }
    },
    volatility: {
      ar: {
        what: 'قد إيه السهم بيتحرك بشكل طبيعي.',
        why: 'بيأثر على حجم المركز المناسب، وعلى واقعية الهدف ووقف الخسارة.',
        how: 'OCTA يقيس التذبذب **نسبياً لتاريخ السهم نفسه** (ATR% ÷ متوسطه التاريخي) مش عتبة مطلقة لكل البورصة.',
        not: 'تذبذب منخفض مش معناه أمان. وتذبذب عالي مش إشارة إيجابية — ده مخاطرة أعلى.'
      },
      en: {
        what: 'How much the stock normally moves.',
        why: 'It affects sensible position size and whether a target or stop is realistic.',
        how: 'OCTA measures volatility **relative to the stock\'s own history** (ATR% ÷ its historical average), not one absolute threshold for the whole market.',
        not: 'Low volatility does not mean safety. High volatility is not a positive signal — it is more risk.'
      }
    },
    smartMoney: {
      ar: {
        what: 'قوة الأدلة المتاحة على وجود نشاط تداول جاد.',
        why: 'بيساعدك تفرق بين حركة عادية وحركة مدعومة بنشاط.',
        how: 'OCTA يجمع ٤ أدلة (توسّع الحجم · تأكيد السعر بالحجم · توصية المحللين · شذوذ الدوران) بوزن ثقة لكل واحد.',
        not: '⛔ **مش كاشف مؤسسات.** بيانات الملكية المؤسسية وتدفق الأوامر غير متاحة عندنا. حجم عالي مش دليل شراء مؤسسات.'
      },
      en: {
        what: 'The strength of available evidence of serious trading activity.',
        why: 'It helps distinguish an ordinary move from one backed by real participation.',
        how: 'OCTA combines four evidence types (volume expansion, price-volume confirmation, analyst consensus, turnover anomaly) with a confidence weight each.',
        not: '⛔ **This is not an institutional detector.** Institutional ownership data and order flow are not available to us. High volume is not proof of institutional buying.'
      }
    },
    smartMoneyUnavailable: {
      ar: {
        what: 'بيانات نشاط المؤسسات (ملكية · تدفق أوامر · مفاضلة بين المشترين والبائعين).',
        why: 'كانت هتفرق بين «نشاط حقيقي» و«حركة على نصيب عادي».',
        how: '⛔ **غير متاحة** — مفيش مصدر عام بيوصفكو. عشان كده OCTA بيقول «أدلة متاحة» مش «شراء مؤسسات».',
        not: 'مافيش درجة «نشاط مؤسسات» بتُحتسب. أي رقم هنا هيكون مخترع.'
      },
      en: {
        what: 'Institutional activity data (ownership, order flow, buyer/seller classification).',
        why: 'It would separate genuine activity from an ordinary share of trading.',
        how: '⛔ **Not available** — no public source describes it. That is why OCTA says "available evidence", never "institutional buying".',
        not: 'No institutional score is computed. Any such number would be fabricated.'
      }
    },
    riskReward: {
      ar: {
        what: 'العائد المتوقّع مقابل المخاطرة: (الهدف − الدخول) ÷ (الدخول − الوقف).',
        why: 'بيوضح لك العائد على كل جنيه بتخاطر بيه.',
        how: 'OCTA يحسبها من الهدف والوقف الفعليين (مش من رقم مفترض).',
        not: 'مش احتمال ربح. هي نسبة رياضية بس.'
      },
      en: {
        what: 'Expected reward versus risk: (target − entry) ÷ (entry − stop).',
        why: 'It shows the return for every unit you put at risk.',
        how: 'OCTA computes it from the actual target and stop levels (not from an assumed number).',
        not: 'It is not a probability of profit. It is a mathematical ratio only.'
      }
    },
    stopLoss: {
      ar: {
        what: 'المستوى اللي بتخسر عنده لو السعر عكسك.',
        why: 'بيحدّ الخسارة الأقصى للصفقة الواحدة.',
        how: 'OCTA يحسبه من ATR (المسافة = ATR × مضاعِف) ويقارنه بوقف الهيكل، ولو اختلفوا كتير بيقول «محتاج مراجعة» بدل ما يختار الأنضف.',
        not: 'الوقف مش بيضمن التنفيذ عند السعر ده، خصوصاً في الأسهم قليلة السيولة.'
      },
      en: {
        what: 'The level at which you take the loss if price moves against you.',
        why: 'It caps the maximum loss on a single position.',
        how: 'OCTA derives it from ATR (distance = ATR × multiplier) and compares it with the structure stop; if they differ materially it flags "requires review" instead of picking the prettier one.',
        not: 'A stop does not guarantee execution at that price, especially in illiquid stocks.'
      }
    },
    takeProfit: {
      ar: {
        what: 'المستوى المستهدف للربح.',
        why: 'بيحدّد هدف الصفقة بدل الاعتماد على تفاؤل.',
        how: 'OCTA بيحسبه من المقاومة التاريخية الحقيقية أو من ATR — ومينفعش يخلط الطريقتين من غير إعلان.',
        not: 'الهدف مش وعد. والسعر ممكن يعدّي من غير ما executes.'
      },
      en: {
        what: 'The target level for taking profit.',
        why: 'It gives the trade a defined goal instead of relying on optimism.',
        how: 'OCTA derives it from real historical resistance or from ATR — and never mixes the two methods without disclosure.',
        not: 'A target is not a promise. Price may pass through it without filling.'
      }
    },
    positionSize: {
      ar: {
        what: 'عدد الأسهم اللي تقدر تشتريها ضمن حدود مخاطرك.',
        why: 'بيحوّل «مخاطرة ١٪» لرقم ملموس.',
        how: 'OCTA يحسبه: (مبلغ المخاطرة) ÷ (الدخول − الوقف)، وبيراع�� سقف التخصيص.',
        not: 'مش نصيحة استثمار · الحساب بيستخدم تكاليف المعاملة غير المعروفة.'
      },
      en: {
        what: 'The number of shares you can buy within your own risk limits.',
        why: 'It turns "1% risk" into a concrete number.',
        how: 'OCTA computes risk amount ÷ (entry − stop) and respects the maximum allocation cap.',
        not: 'Not investment advice, and the calculation excludes transaction costs we cannot verify.'
      }
    },
    liquidity: {
      ar: {
        what: 'قد إيه السهم بيتداول بسهولة: نسبة حجم التداول إلى عدد الأسهم.',
        why: 'السهم ضعيف السيولة صعب الدخول والخروج منه.',
        how: 'OCTA يقيسها كنسبة دوران يومية (حجم التداول ÷ حجم السهم) ويقارنها بالسوق.',
        not: 'سيولة عالية مش معناه سهر نابحة — ولا سيولة منخفضة تعني سهم سيّئ.'
      },
      en: {
        what: 'How easily the stock trades: trading volume relative to shares outstanding.',
        why: 'An illiquid stock is hard to enter and exit.',
        how: 'OCTA measures it as daily turnover (volume ÷ shares outstanding) and compares it against the market.',
        not: 'High liquidity is not a bullish signal, and low liquidity does not mean a bad business.'
      }
    },
    compositeScore: {
      ar: {
        what: 'درجة تحليلية مختصرة تجمع الاتجاه والزخم والحجم والمخاطرة.',
        why: 'بتساعدك ترتيب النتائج بسرعة.',
        how: 'OCTA يجمع الدرجات بأوزان قابلة للضبط (٣٥/٢٥/٢٠/٢٠ في المتوازن)، ويعيد توزيع أي وزن لمؤشر ناقص.',
        not: '⛔ **مش احتمال ربح.** الدرجة ٨٥ معناها ٨٥ من ١٠٠ على أساس تحليلي، مش ٨٥٪ فرصة نجاح.'
      },
      en: {
        what: 'A compact analytical score combining trend, momentum, volume and risk.',
        why: 'It helps you order results quickly.',
        how: 'OCTA combines the scores with adjustable weights (35/25/20/20 in balanced) and redistributes the weight of any missing indicator.',
        not: '⛔ **Not a probability of profit.** A score of 85 means 85/100 on an analytical basis, not an 85% chance of success.'
      }
    },
    classification: {
      ar: {
        what: 'حالة السهم النهائية حسب شروط البروفايل المختار.',
        why: 'بتحدّد هل السهم ده يستحق مراجعة بشرية.',
        how: 'OCTA بيقيس كل شرط على حدة وبيقولك بالظبط إيه اللي ناقص أو إيه اللي اتحقق.',
        not: 'مش «شراء» ولا «بيع». التصنيف بيقول: السهم ده يستحق مراجعة أو لأ.'
      },
      en: {
        what: "The stock's final state against the selected strategy profile.",
        why: 'It decides whether the stock deserves human review.',
        how: 'OCTA evaluates each condition separately and tells you exactly what passed and what is missing.',
        not: 'Not "buy" and not "sell". The classification says whether the stock deserves review.'
      }
    },
    dataFreshness: {
      ar: {
        what: 'متى كانت آخر جلسة متاحة في البيانات.',
        why: 'بيانات قديمة ⇒ المؤشرات بتتكلم عن زمن فات.',
        how: 'OCTA بيقارن تاريخ آخر شمعة بتاريخ اليوم وبيعلن البيانات القديمة صراحة.',
        not: 'السوق مقفول ≠ بيانات خاطئة — بس لازم تعرف إنك بتقرأ آخر جلسة.'
      },
      en: {
        what: 'When the last available session in the data was.',
        why: 'Stale data means the indicators describe a past that has moved on.',
        how: 'OCTA compares the last candle date against today and states stale data explicitly.',
        not: 'A closed market does not mean wrong data — but you must know you are reading the last session.'
      }
    }
  };

  /* ══════════════════════════════════════════════════════════════
   🔤 أدوات مساعدة للترجمة
   ══════════════════════════════════════════════════════════════ */
  function L(lang) { return lang === 'en' ? 'en' : 'ar'; }
  function T(lang) { return lang === 'en' ? TERMS_EN : TERMS_AR; }

  /* ══════════════════════════════════════════════════════════════
   🇪🇬🇬🇧 ترجمة الحالات
   ══════════════════════════════════════════════════════════════ */
  var STATES_AR = {
    UPTREND: 'صاعد', DOWNTREND: 'هابط', SIDEWAYS: 'عرضي',
    'TREND TRANSITION': 'انتقال في الاتجاه', 'INSUFFICIENT DATA': 'بيانات غير كافية',
    'STRONG POSITIVE MOMENTUM': 'زخم إيجابي قوي', 'POSITIVE MOMENTUM': 'زخم إيجابي',
    'NEUTRAL MOMENTUM': 'زخم محايد', 'NEGATIVE MOMENTUM': 'زخم سلبي',
    'STRONG NEGATIVE MOMENTUM': 'زخم سلبي قوي', OVERBOUGHT: 'تشبع شرائي', OVERSOLD: 'تشبع بيعي',
    'LOW VOLUME': 'حجم ضعيف', 'NORMAL VOLUME': 'حجم طبيعي', 'HIGH VOLUME': 'حجم مرتفع',
    'UNUSUAL VOLUME': 'حجم استثنائي',
    'LOW VOLATILITY': 'تذبذب منخفض', 'NORMAL VOLATILITY': 'تذبذب طبيعي',
    'HIGH VOLATILITY': 'تذبذب مرتفع', 'EXTREME VOLATILITY': 'تذبذب شديد',
    'DEEP': 'سيولة عالية جداً', 'LIQUID': 'سيولة عالية', 'MODERATE': 'سيولة متوسطة',
    'THIN': 'سيولة ضعيفة', 'ILLIQUID': 'سيولة ضعيفة جداً',
    'WAITING FOR CONFIRMATION': 'في انتظار تأكيد', 'POTENTIAL ENTRY ZONE': 'منطقة دخول محتملة',
    'CONFIRMED ANALYTICAL SETUP': 'إعداد تحليلي مؤكد', 'SETUP INVALIDATED': 'الإعداد غير صالح',
    'PLAN UNAVAILABLE': 'مفيش خطة متاحة', 'TARGET UNAVAILABLE': 'مفيش هدف متاح',
    'LOWER RELATIVE RISK': 'مخاطرة نسبية منخفضة', 'MODERATE RISK': 'مخاطرة متوسطة',
    'HIGH RISK': 'مخاطرة عالية', 'VERY HIGH RISK': 'مخاطرة عالية جداً',
    'RISK NOT ASSESSABLE': 'المخاطرة غير قابلة للتقييم',
    'STRONG SUPPORTING EVIDENCE': 'أدلة داعمة قوية', 'MODERATE SUPPORTING EVIDENCE': 'أدلة داعمة متوسطة',
    'MIXED EVIDENCE': 'أدلة متضاربة', 'WEAK EVIDENCE': 'أدلة ضعيفة',
    'STRONG ANALYTICAL CANDIDATE': 'مرشح تحليلي قوي',
    'CANDIDATE — NEEDS CONFIRMATION': 'مرشح — محتاج تأكيد',
    'HIGH RISK CANDIDATE': 'مرشح بمخاطرة عالية',
    'NO CURRENT SETUP': 'مفيش إعداد حالياً', 'INSUFFICIENT DATA': 'بيانات غير كافية',
    'HIGH': 'عالية', 'MEDIUM': 'متوسطة', 'LOW': 'ضعيفة', 'NONE': 'لا شيء'
  };
  var STATES_EN = {
    UPTREND: 'Uptrend', DOWNTREND: 'Downtrend', SIDEWAYS: 'Sideways',
    'TREND TRANSITION': 'Trend transition', 'INSUFFICIENT DATA': 'Insufficient data',
    'STRONG POSITIVE MOMENTUM': 'Strong positive momentum', 'POSITIVE MOMENTUM': 'Positive momentum',
    'NEUTRAL MOMENTUM': 'Neutral momentum', 'NEGATIVE MOMENTUM': 'Negative momentum',
    'STRONG NEGATIVE MOMENTUM': 'Strong negative momentum', OVERBOUGHT: 'Overbought', OVERSOLD: 'Oversold',
    'LOW VOLUME': 'Low volume', 'NORMAL VOLUME': 'Normal volume', 'HIGH VOLUME': 'High volume',
    'UNUSUAL VOLUME': 'Unusual volume',
    'LOW VOLATILITY': 'Low volatility', 'NORMAL VOLATILITY': 'Normal volatility',
    'HIGH VOLATILITY': 'High volatility', 'EXTREME VOLATILITY': 'Extreme volatility',
    'DEEP': 'Very deep liquidity', 'LIQUID': 'Deep liquidity', 'MODERATE': 'Moderate liquidity',
    'THIN': 'Thin liquidity', 'ILLIQUID': 'Very thin liquidity',
    'WAITING FOR CONFIRMATION': 'Waiting for confirmation', 'POTENTIAL ENTRY ZONE': 'Potential entry zone',
    'CONFIRMED ANALYTICAL SETUP': 'Confirmed analytical setup', 'SETUP INVALIDATED': 'Setup invalidated',
    'PLAN UNAVAILABLE': 'Plan unavailable', 'TARGET UNAVAILABLE': 'Target unavailable',
    'LOWER RELATIVE RISK': 'Lower relative risk', 'MODERATE RISK': 'Moderate risk',
    'HIGH RISK': 'High risk', 'VERY HIGH RISK': 'Very high risk',
    'RISK NOT ASSESSABLE': 'Risk not assessable',
    'STRONG SUPPORTING EVIDENCE': 'Strong supporting evidence', 'MODERATE SUPPORTING EVIDENCE': 'Moderate supporting evidence',
    'MIXED EVIDENCE': 'Mixed evidence', 'WEAK EVIDENCE': 'Weak evidence',
    'STRONG ANALYTICAL CANDIDATE': 'Strong analytical candidate',
    'CANDIDATE — NEEDS CONFIRMATION': 'Candidate — needs confirmation',
    'HIGH RISK CANDIDATE': 'High-risk candidate',
    'NO CURRENT SETUP': 'No current setup', 'INSUFFICIENT DATA': 'Insufficient data',
    'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low', 'NONE': 'None'
  };
  var TERMS_AR = {};   /*Terms[lang]  */
  var TERMS_EN = {};

  function tr(lang, key) {
    var map = lang === 'en' ? STATES_EN : STATES_AR;
    return map[key] || key;
  }

  /* ══════════════════════════════════════════════════════════════
   📝 شرح كل مؤشر على حدة
   ══════════════════════════════════════════════════════════════ */

  function trendText(a, lang) {
    var t = a.trend || {};
    if (t.state === 'INSUFFICIENT DATA') {
      return lang === 'en'
        ? 'Not enough sessions to judge the trend.'
        : 'الجلسات المتاحة مش كفاية للحكم على الاتجاه.';
    }
    var out = [];
    if (t.ema20 != null && t.ema50 != null) {
      out.push(lang === 'en'
        ? 'EMA20 (' + t.ema20 + ') is ' + (t.ema20 > t.ema50 ? 'above' : 'below') + ' EMA50 (' + t.ema50 + ')'
        : 'EMA20 (' + t.ema20 + ') ' + (t.ema20 > t.ema50 ? 'فوق' : 'تحت') + ' EMA50 (' + t.ema50 + ')');
    }
    if (t.ema200 != null) {
      out.push(lang === 'en'
        ? 'EMA50 is ' + (t.ema50 > t.ema200 ? 'above' : 'below') + ' EMA200 (' + t.ema200 + ')'
        : 'EMA50 ' + (t.ema50 > t.ema200 ? 'فوق' : 'تحت') + ' EMA200 (' + t.ema200 + ')');
    } else {
      out.push(lang === 'en' ? 'EMA200 unavailable (fewer than 200 sessions)'
        : 'EMA200 غير متاح (أقل من ٢٠٠ جلسة)');
    }
    if (t.adx != null) {
      var s = t.strength === 'STRONG' ? (lang === 'en' ? 'strong' : 'قوية')
        : t.strength === 'MODERATE' ? (lang === 'en' ? 'moderate' : 'متوسطة')
        : t.strength === 'WEAK' ? (lang === 'en' ? 'weak' : 'ضعيفة')
        : (lang === 'en' ? 'absent' : 'غير موجودة');
      out.push(lang === 'en'
        ? 'Trend strength (ADX ' + t.adx + '): ' + s
        : 'قوة الاتجاه (ADX ' + t.adx + '): ' + s);
    }
    if (t.structure && t.structure.bias) {
      out.push(lang === 'en'
        ? 'Structure is ' + t.structure.bias
        : 'بنية السوق ' + (t.structure.bias === 'up' ? 'صاعدة' : t.structure.bias === 'down' ? 'هابطة' : 'متعارضة'));
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  function momentumText(a, lang) {
    var m = a.momentum || {};
    if (m.state === 'INSUFFICIENT DATA') {
      return lang === 'en' ? 'Not enough sessions for momentum.'
        : 'الجلسات المتاحة مش كفاية لحساب الزخم.';
    }
    var out = [];
    if (m.rsi != null) {
      out.push(lang === 'en' ? 'RSI ' + m.rsi + ' (' + (m.zone || '') + ')'
        : 'RSI ' + m.rsi + (m.zone === 'overbought' ? ' (تشبع شرائي)' : m.zone === 'oversold' ? ' (تشبع بيعي)' : ''));
    }
    if (m.macd != null && m.signal != null) {
      out.push(lang === 'en'
        ? 'MACD is ' + (m.macd > m.signal ? 'above' : 'below') + ' its signal line'
        : 'MACD ' + (m.macd > m.signal ? 'فوق' : 'تحت') + ' خط الإشارة');
    }
    if (m.rsiSlope != null && Math.abs(m.rsiSlope) >= 0.1) {
      var fade = m.rsiSlope < 0;
      var dirPos = m.dirState && m.dirState.indexOf('POSITIVE') >= 0;
      var dirNeg = m.dirState && m.dirState.indexOf('NEGATIVE') >= 0;
      /* ⛔ «زخم إيجابي + بيضعف» مش تناقض لو اتقروا كجملة واحدة */
      if (lang === 'en') {
        out.push(fade
          ? (dirPos ? 'Momentum is positive but fading' : 'Momentum is fading')
          : (dirNeg ? 'Momentum is negative but building' : 'Momentum is building'));
      } else {
        out.push(fade
          ? (dirPos ? 'الزخم إيجابي لكنه بيضعف' : 'الزخم بيضعف')
          : (dirNeg ? 'الزخم سلبي لكنه بيتقوى' : 'الزخم بيتقوى'));
      }
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  function volumeText(a, lang) {
    var v = a.volume || {};
    if (v.state === 'INSUFFICIENT DATA') {
      return lang === 'en' ? 'Not enough sessions for volume analysis.'
        : 'الجلسات المتاحة مش كفاية لتحليل الحجم.';
    }
    var out = [];
    if (v.rvol != null) {
      out.push(lang === 'en'
        ? 'Today\'s volume is ' + v.rvol + '× the 20-session average'
        : 'حجم اليوم ' + v.rvol + '× متوسط ٢٠ جلسة سابقة');
    }
    if (v.move5 != null) {
      /* ⛔ «+0%» مربك — نقول «ثابت» */
      var flat = Math.abs(v.move5) < 0.15;
      out.push(lang === 'en'
        ? (flat ? 'Price is flat over 5 sessions' : 'Price moved ' + (v.move5 >= 0 ? '+' : '') + v.move5 + '% over 5 sessions')
        : (flat ? 'السعر ثابت على ٥ جلسات' : 'السعر تحرّك ' + (v.move5 >= 0 ? '+' : '') + v.move5 + '% على ٥ جلسات'));
    }
    if (v.liq && v.liq !== 'NONE') {
      out.push(lang === 'en'
        ? 'Turnover ' + v.turnover + '% of shares outstanding'
        : 'نسبة الدوران ' + v.turnover + '% من عدد الأسهم');
    }
    if (v.score != null && v.score < 40 && v.rvol != null && v.rvol >= 1.5) {
      out.push(lang === 'en'
        ? '⚠️ High volume with falling price — possible distribution, not accumulation'
        : '⚠️ حجم عالي مع هبوط في السعر — سلوك توزيع محتمل مش استحواذ');
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  function volatilityText(a, lang) {
    var v = a.volatility || {};
    if (v.state === 'INSUFFICIENT DATA') {
      return lang === 'en' ? 'Not enough sessions for volatility.'
        : 'الجلسات المتاحة مش كفاية لقياس التذبذب.';
    }
    var out = [];
    if (v.atr != null) {
      out.push(lang === 'en'
        ? 'ATR(14) is ' + v.atr + ' (' + v.atrPct + '% of price)'
        : 'ATR(14) = ' + v.atr + ' (' + v.atrPct + '% من السعر)');
    }
    if (v.rel != null) {
      out.push(lang === 'en'
        ? 'That is ' + v.rel + '× its own historical average'
        : 'ده ' + v.rel + '× متوسطه التاريخي');
    }
    if (v.avgRange != null) {
      out.push(lang === 'en'
        ? 'Average daily range ' + v.avgRange
        : 'متوسط النطاق اليومي ' + v.avgRange);
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  function smartText(a, lang) {
    var s = a.smart || {};
    var out = [];
    if (s.components && s.components.length) {
      out.push(lang === 'en'
        ? s.components.length + ' evidence types available (confidence: ' + (s.confidence || 'none').toLowerCase() + ')'
        : s.components.length + ' أنواع أدلة متاحة (الثقة: ' + tr(lang, s.confidence) + ')');
    }
    if (s.institutionalAvailable === false) {
      out.push(lang === 'en'
        ? '⛔ Institutional activity data is not available'
        : '⛔ بيانات نشاط المؤسسات غير متاحة');
    }
    if (s.disclaimer) {
      out.push(lang === 'en' ? s.disclaimer : 'حجم عالي مش دليل شراء مؤسسات — الأدلة من السعر والحجم وتوصية المحللين بس.');
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  function planText(a, lang) {
    var p = a.plan || {};
    if (p.status === 'PLAN UNAVAILABLE') {
      return lang === 'en'
        ? (p.message || 'No entry plan could be built from the available structure.')
        : (p.message || 'مفيش خطة دخول قابلة للبناء من البنية المتاحة.');
    }
    var out = [];
    if (p.entry != null) {
      out.push(lang === 'en'
        ? 'Entry ' + p.entry + (p.entryLo != null && p.entryHi != null ? ' (zone ' + p.entryLo + '–' + p.entryHi + ')' : '')
        : 'الدخول ' + p.entry + (p.entryLo != null && p.entryHi != null ? ' (منطقة ' + p.entryLo + '–' + p.entryHi + ')' : ''));
    }
    if (p.stop != null) {
      out.push(lang === 'en' ? 'Stop ' + p.stop : 'الوقف ' + p.stop);
    }
    if (p.target1 != null) {
      out.push(lang === 'en' ? 'Target 1 ' + p.target1 : 'الهدف الأول ' + p.target1);
    } else {
      out.push(lang === 'en' ? 'Target unavailable' : 'مفيش هدف متاح');
    }
    if (p.rr != null) {
      out.push(lang === 'en' ? 'Reward/risk ' + p.rr : 'نسبة العائد ' + p.rr);
    }
    if (p.confirm) {
      out.push(lang === 'en' ? 'Confirmation: ' + p.confirm : 'التأكيد: ' + p.confirm);
    }
    return out.join(lang === 'en' ? ' · ' : ' · ');
  }

  /* ══════════════════════════════════════════════════════════════
   🏷️ البطاقة النهائية (سهلة الفهم)
   ══════════════════════════════════════════════════════════════ */
  function card(a, lang) {
    var c = a.classification || {};
    var tr_ = a.trend || {}, mo = a.momentum || {}, vo = a.volume || {},
      va = a.volatility || {}, ri = a.risk || {}, pl = a.plan || {};
    var lines = [
      { k: 'trend', label: lang === 'en' ? 'Trend' : 'الاتجاه', value: tr(lang, tr_.state) },
      { k: 'momentum', label: lang === 'en' ? 'Momentum' : 'الزخم', value: tr(lang, mo.state) },
      { k: 'volume', label: lang === 'en' ? 'Volume' : 'حجم التداول', value: tr(lang, vo.state) },
      { k: 'volatility', label: lang === 'en' ? 'Volatility' : 'التذبذب', value: tr(lang, va.state) },
      { k: 'smart', label: lang === 'en' ? 'Smart money evidence' : 'دليل النشاط الذكي', value: tr(lang, (a.smart || {}).state) },
      { k: 'risk', label: lang === 'en' ? 'Risk' : 'المخاطرة', value: tr(lang, ri.state) },
      { k: 'plan', label: lang === 'en' ? 'Entry plan' : 'خطة الدخول', value: tr(lang, pl.status) }
    ];
    var title;
    if (c.code === 'A') title = lang === 'en' ? 'The stock fits the criteria' : 'السهم مناسب للتحليل';
    else if (c.code === 'B') title = lang === 'en' ? 'Promising, but needs confirmation' : 'فيه علامات إيجابية بس محتاج تأكيد';
    else if (c.code === 'C') title = lang === 'en' ? 'Positive signs, but the risk does not qualify' : 'فيه مؤشرات إيجابية بس المخاطرة مش مقبولة';
    else if (c.code === 'D') title = lang === 'en' ? 'No analytical setup right now' : 'مفيش إعداد تحليلي حالياً';
    else title = lang === 'en' ? 'Not enough data to analyze' : 'بيانات غير كافية للتحليل';

    /* 📌 السبب — مولّد من الأرقام، مش قالب عام */
    var reason = '';
    if (c.code === 'E') {
      reason = lang === 'en'
        ? 'There are not enough valid sessions to analyze this stock reliably.'
        : 'الجلسات المتاحة مش كفاية لتحليل السهم بشكل موثوق.';
    } else {
      var pos = [], neg = [];
      if (tr_.state === 'UPTREND') pos.push(lang === 'en' ? 'the trend is up' : 'الاتجاه صاعد');
      else if (tr_.state === 'DOWNTREND') neg.push(lang === 'en' ? 'the trend is down' : 'الاتجاه هابط');
      if (mo.dirState && mo.dirState.indexOf('POSITIVE') >= 0) pos.push(lang === 'en' ? 'momentum is positive' : 'الزخم إيجابي');
      else if (mo.dirState && mo.dirState.indexOf('NEGATIVE') >= 0) neg.push(lang === 'en' ? 'momentum is negative' : 'الزخم سلبي');
      if (vo.rvol != null && vo.rvol >= 1.3) pos.push(lang === 'en' ? 'trading activity is above normal' : 'نشاط التداول أعلى من المعتاد');
      if (va.atrPct != null && va.atrPct > 8) neg.push(lang === 'en' ? 'volatility is high' : 'التذبذب مرتفع');
      if (ri.state === 'HIGH RISK' || ri.state === 'VERY HIGH RISK') neg.push(lang === 'en' ? 'risk constraints are not met' : 'شروط المخاطرة مش متحققة');
      if ((a.smart || {}).institutionalAvailable === false) neg.push(lang === 'en' ? 'institutional data is unavailable' : 'بيانات المؤسسات غير متاحة');
      var parts = [];
      if (pos.length) parts.push(lang === 'en' ? 'Positively: ' + pos.join(', ') + '.' : 'إيجابي: ' + pos.join('، ') + '.');
      if (neg.length) parts.push(lang === 'en' ? 'Against: ' + neg.join(', ') + '.' : 'ضدّ: ' + neg.join('، ') + '.');
      reason = parts.join(' ');
    }
    return { title: title, reason: reason, status: tr(lang, c.state), lines: lines, code: c.code };
  }

  /* ══════════════════════════════════════════════════════════════
   🧮 شرح الدرجة
   ══════════════════════════════════════════════════════════════ */
  function scoreExplain(a, lang) {
    var sc = a.score || {};
    var labels = {
      trend: lang === 'en' ? 'Trend' : 'الاتجاه',
      momentum: lang === 'en' ? 'Momentum' : 'الزخم',
      volume: lang === 'en' ? 'Volume' : 'الحجم',
      risk: lang === 'en' ? 'Risk / volatility' : 'المخاطرة / التذبذب'
    };
    var rows = [];
    Object.keys(sc.used || {}).forEach(function (k) {
      rows.push({
        k: k, label: labels[k] || k, value: sc.used[k],
        weight: (sc.adjusted && sc.adjusted[k] != null) ? sc.adjusted[k] : null,
        baseWeight: (sc.weights && sc.weights[k] != null) ? sc.weights[k] : null
      });
    });
    var missing = (sc.missing || []).map(function (k) {
      return { k: k, label: labels[k] || k };
    });
    var note = null;
    if (sc.insufficient) {
      note = lang === 'en'
        ? 'Not enough valid indicators to compute a composite score.'
        : 'المؤشرات المتاحة أقل من الحد الأدنى لحساب درجة مركّبة.';
    } else if (missing.length) {
      note = lang === 'en'
        ? 'Weights were redistributed across the available indicators (' + (sc.completeness) + '% complete).'
        : 'تم إعادة توزيع الأوزان على المؤشرات المتاحة (' + (sc.completeness) + '% تغطية).';
    }
    return {
      total: sc.total, rows: rows, missing: missing, note: note,
      completeness: sc.completeness,
      label: lang === 'en' ? 'ANALYTICAL SCORE' : 'درجة تحليلية'
    };
  }

  /* ══════════════════════════════════════════════════════════════
   🔄 كيف الرادار بيحلل السهم؟
   ══════════════════════════════════════════════════════════════ */
  function steps(a, lang) {
    var dq = a.dq || {}, tr_ = a.trend || {}, mo = a.momentum || {}, vo = a.volume || {},
      va = a.volatility || {}, sm = a.smart || {}, pl = a.plan || {}, ri = a.risk || {},
      sc = a.score || {};
    function st(ok, na) { return na ? 'na' : (ok ? 'ok' : 'warn'); }
    var list = [
      { n: 1, ar: 'بنجمع بيانات الأسهم المتاحة', en: 'We collect the available stock data',
        status: dq.sessions ? 'ok' : 'na', detail: (dq.sessions || 0) + ' ' + (lang === 'en' ? 'sessions' : 'جلسة') },
      { n: 2, ar: 'بنفحص الاتجاه', en: 'We check the trend', status: st(tr_.score != null, !tr_.score), detail: tr(lang, tr_.state) },
      { n: 3, ar: 'بنحلل الزخم', en: 'We analyse momentum', status: st(mo.score != null, !mo.score), detail: tr(lang, mo.state) },
      { n: 4, ar: 'بنراجع حجم التداول والسيولة', en: 'We review volume and liquidity', status: st(vo.score != null, !vo.score), detail: tr(lang, vo.state) },
      { n: 5, ar: 'نقيس التذبذب', en: 'We measure volatility', status: st(va.score != null, !va.score), detail: tr(lang, va.state) },
      { n: 6, ar: 'بنراجع أدلة نشاط التداول', en: 'We review trading-activity evidence', status: 'warn', detail: tr(lang, sm.state) },
      { n: 7, ar: 'بنحسب مستويات الدخول والمخاطرة', en: 'We compute entry levels and risk', status: st(pl.entry != null, pl.status === 'PLAN UNAVAILABLE'), detail: tr(lang, pl.status) },
      { n: 8, ar: 'بنحدد التصنيف النهائي', en: 'We set the final classification', status: 'ok', detail: tr(lang, (a.classification || {}).state) }
    ];
    return list.map(function (x) {
      return { n: x.n, title: lang === 'en' ? x.en : x.ar, status: x.status, detail: x.detail };
    });
  }

  /* ══════════════════════════════════════════════════════════════
   📚 الشرح التعليمي لكل مصطلح
   ══════════════════════════════════════════════════════════════ */
  function term(key, lang) {
    var t = TERMS[key];
    if (!t) return null;
    var o = lang === 'en' ? t.en : t.ar;
    return { key: key, what: o.what, why: o.why, how: o.how, not: o.not };
  }

  return {
    TERMS: TERMS, STATES_AR: STATES_AR, STATES_EN: STATES_EN,
    tr: tr, term: term,
    trendText: trendText, momentumText: momentumText, volumeText: volumeText,
    volatilityText: volatilityText, smartText: smartText, planText: planText,
    card: card, scoreExplain: scoreExplain, steps: steps
  };
});
