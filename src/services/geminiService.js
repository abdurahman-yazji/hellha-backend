const { z } = require('zod');

const diagnosisJsonSchema = {
  type: 'object',
  properties: {
    predicted_fault: {
      type: 'string',
      description: 'اسم مختصر وواضح للعطل المتوقع باللغة العربية',
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'درجة خطورة المشكلة',
    },
    tools: {
      type: 'array',
      description: 'أدوات منزلية آمنة قد يحتاجها المستخدم',
      items: {
        type: 'string',
      },
    },
    guide: {
      type: 'array',
      description: 'خطوات فحص أو حل آمنة ومرتبة باللغة العربية',
      items: {
        type: 'string',
      },
    },
    safety_warnings: {
      type: 'array',
      description: 'تحذيرات السلامة الضرورية باللغة العربية',
      items: {
        type: 'string',
      },
    },
    requires_technician: {
      type: 'boolean',
      description: 'هل تتطلب المشكلة فنيًا متخصصًا',
    },
  },
  required: [
    'predicted_fault',
    'severity',
    'tools',
    'guide',
    'safety_warnings',
    'requires_technician',
  ],
};

const diagnosisSchema = z.fromJSONSchema(
  diagnosisJsonSchema
);

let geminiClientPromise;

const getGeminiClient = async () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!geminiClientPromise) {
    geminiClientPromise = import('@google/genai').then(
      ({ GoogleGenAI }) => {
        return new GoogleGenAI({
          apiKey,
        });
      }
    );
  }

  return geminiClientPromise;
};

const buildDiagnosisPrompt = ({
  category,
  description,
}) => {
  const selectedCategory =
    category || 'غير محدد من المستخدم';

  return `
أنت مساعد متخصص في التشخيص الأولي والآمن لمشكلات الصيانة المنزلية.

معلومات المشكلة:
- التصنيف الذي اختاره المستخدم: ${selectedCategory}
- وصف المستخدم: ${description}

التعليمات:
1. أجب باللغة العربية الواضحة والمناسبة للمستخدم غير المتخصص.
2. قدّم تشخيصًا أوليًا محتملًا، ولا تدّعِ اليقين الكامل.
3. صنّف الخطورة إلى واحدة فقط:
   low أو medium أو high أو critical.
4. لا تقترح أي خطوة قد تعرض المستخدم لخطر الكهرباء أو الغاز أو الحريق أو المواد الكيميائية أو السقوط.
5. إذا كانت المشكلة high أو critical:
   - اجعل requires_technician تساوي true.
   - لا تعطِ خطوات إصلاح داخلية أو تفكيك.
   - أعطِ فقط خطوات سلامة وإيقاف استخدام المصدر إن كان ذلك آمنًا.
6. إذا ذُكر دخان أو حريق أو رائحة غاز أو شرر أو أسلاك مكشوفة أو خطر إنشائي:
   صنّف المشكلة critical.
7. لا تقترح خلط مواد التنظيف أو استخدام أدوات كهربائية قرب الماء.
8. اجعل خطوات guide قصيرة ومرتبة وقابلة للفهم.
9. لا تضع نصًا خارج بنية JSON المطلوبة.
`.trim();
};

const applySafetyRules = (diagnosis) => {
  const normalizedSeverity =
    diagnosis.severity.toLowerCase();

  const requiresTechnician =
    diagnosis.requires_technician ||
    normalizedSeverity === 'high' ||
    normalizedSeverity === 'critical';

  if (normalizedSeverity !== 'critical') {
    return {
      ...diagnosis,
      severity: normalizedSeverity,
      requires_technician: requiresTechnician,
    };
  }

  return {
    ...diagnosis,
    severity: 'critical',
    tools: [],
    guide: [
      'ابتعد عن مصدر الخطر فورًا.',
      'أوقف استخدام الجهاز أو المنطقة المتضررة.',
      'افصل مصدر الكهرباء أو الغاز فقط إذا كان ذلك آمنًا.',
      'اطلب مساعدة فني متخصص أو جهة طوارئ مناسبة.',
    ],
    requires_technician: true,
  };
};

const diagnoseMaintenanceIssue = async ({
  category,
  description,
}) => {
  const trimmedDescription = description?.trim();

  if (!trimmedDescription) {
    throw new TypeError(
      'A maintenance issue description is required'
    );
  }

  const ai = await getGeminiClient();

  const interaction = await ai.interactions.create({
    model:
      process.env.GEMINI_MODEL ||
      'gemini-3-flash-preview',
    input: buildDiagnosisPrompt({
      category,
      description: trimmedDescription,
    }),
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: diagnosisJsonSchema,
    },
  });

  const outputText = interaction.output_text;

  if (!outputText) {
    throw new Error(
      'Gemini returned an empty diagnosis response'
    );
  }

  const parsedResponse = JSON.parse(outputText);
  const validatedDiagnosis =
    diagnosisSchema.parse(parsedResponse);

  return applySafetyRules(validatedDiagnosis);
};

module.exports = {
  diagnoseMaintenanceIssue,
};