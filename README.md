# SVUIS API

[العربية](#العربية) | [English](#english)

## العربية

واجهة API لمعلومات الطالب في الجامعة الافتراضية السورية

> **ملاحظة:**  
> ها مشروع مستقل وغير رسمي وليس للجامعة أي علاقة به

### طريقة عمل المشروع

يستقبل المشروع طلبات HTTP، ويتواصل مع نظام معلومات الجامعة نيابةً عن الطالب بعد تسجيل الدخول. يحوّل البيانات المستخرجة من صفحات النظام إلى استجابات JSON، مثل المعلومات الشخصية والعلامات والدفعات. تُحفظ جلسة الطالب مؤقتًا على الخادم، ويستخدم المتصفح ملف تعريف ارتباط للتعرّف عليها في الطلبات اللاحقة.

### حالة وظائف نظام الجامعة

**الوظائف المنفذة في الـ API:**

- تسجيل الدخول والخروج والتحقق من حالة الجلسة.
- قراءة الملف الشخصي وصورة الطالب والسجل الدراسي والمعدل الرسمي.
- قراءة خيارات وجدول الامتحانات، والدفعات، والتقييمات، والصفوف، وتقارير المدرسين.
- قراءة خيارات جدول المحاضرات والجدول وفق المرشحات المتاحة.
- فحص حالة الخدمة واتصالها بنظام الجامعة.

**الوظائف الجزئية أو غير المنفذة:**

- عرض خيارات ومقررات اختيار الصفوف متاح جزئيًا؛ تسجيل الصفوف وإرسال الاختيارات غير منفذين.
- نقطة حالة الدفع الإلكتروني جزئية وغير متحقق من دقتها؛ بدء الدفع وإتمامه غير منفذين.
- تغيير كلمة المرور معطّل مؤقتًا، ورفع مستندات النقابة والخدمة العسكرية غير منفذ؛ تعيد هذه المسارات `501`.
- قراءة التقييمات متاحة، لكن بدء التقييم أو إرسال إجاباته غير منفذ.
- لم تُتحقق جميع الحالات والبرامج فعليًا، بما فيها جدول امتحانات ممتلئ وبعض حالات التقييمات؛ لا يعني تنفيذ المسار ضمان عمله مع كل حساب.

### التوثيق

تتوفر نسخة تجريبية من الـ API على:

- **عنوان الـ API:** [https://90bc-144-76-192-180.ngrok-free.app](https://90bc-144-76-192-180.ngrok-free.app)
- **Swagger:** [استعراض وتجربة الـ API](https://90bc-144-76-192-180.ngrok-free.app/api-docs/)
- **فحص حالة الخدمة:** [Health](https://90bc-144-76-192-180.ngrok-free.app/api/v1/health)

بعد تشغيل المشروع، يمكن استعراض نقاط الـ API وتجربتها من خلال واجهة Swagger على الرابط:

[http://localhost:4000/api-docs](http://localhost:4000/api-docs)

تتطلب معظم الطلبات تسجيل الدخول أولًا من خلال نقطة المصادقة.

### التشغيل المحلي

يتطلب المشروع **Node.js 24 أو أحدث** و**npm**. من داخل مجلد المشروع:

```bash
npm ci
npm run dev
```

تعمل الخدمة افتراضيًا على `http://localhost:4000`. يمكن الاطلاع على الإعدادات المتاحة في `.env.example`؛ تُمرّر متغيرات البيئة إلى عملية التشغيل، إذ لا يُحمّل المشروع ملف `.env` تلقائيًا.

في الإنتاج يجب استخدام HTTPS أمام الخدمة، لأن ملف الجلسة يُضبط بخاصية `Secure` عندما تكون `NODE_ENV=production` ولن يعمل تسجيل الدخول عبر HTTP العادي. عند استخدام وكيل عكسي محلي، يجب أن يمرّر `Host` و`X-Forwarded-Proto` و`X-Forwarded-For` بشكل صحيح؛ لا تعرّض منفذ الخدمة 4000 مباشرة للإنترنت. تغيير كلمة المرور معطّل مؤقتًا إلى أن يمكن التحقق من نجاح العملية لدى النظام الأصلي.

يمكن إصدار شهادة HTTPS موثوقة لعنوان IP عام دون نطاق عبر Let's Encrypt. تتطلب شهادة IP ملف `shortlived` وتجديدًا آليًا، وعمرها نحو 6 أيام. يتطلب مثال `webroot` إصدار Certbot 5.4 أو أحدث، وأن يصل التحقق من الإنترنت إلى منفذ 80. بعد إعداد Nginx لخدمة مسار التحقق من مجلد الويب:

```bash
sudo certbot certonly --staging --preferred-profile shortlived --webroot --webroot-path /var/www/svu-app --ip-address YOUR_PUBLIC_IP
```

استبدل العنوان والمجلد بالقيم الفعلية. شهادة `--staging` للاختبار فقط وغير موثوقة في المتصفح؛ بعد نجاح الاختبار أعد الأمر دون `--staging`. اضبط Nginx يدويًا لاستخدام `fullchain.pem` و`privkey.pem` من مسار الشهادة الذي يعرضه Certbot، وفعّل إعادة تحميل Nginx بعد التجديد، ثم اختبر التجديد باستخدام `sudo certbot renew --dry-run`. الإعداد القديم `deploy/nginx.conf` في المجلد الأب يعمل عبر HTTP فقط وليس إعداد إنتاج آمنًا. راجع [دليل Let's Encrypt لشهادات IP](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/) قبل النشر.

لتشغيل الاختبارات أو بناء المشروع وتشغيل النسخة المبنية:

```bash
npm test
npm run build
npm start
```

---

## English

An API for student information at the Syrian Virtual University.

> **Note:**  
> This is an independent, unofficial project and is not affiliated with the university.

### How it works

The project receives HTTP requests and communicates with the university information system on the student's behalf after login. It converts data extracted from the system's pages into JSON responses, including personal information, grades, and payments. The student's session is temporarily stored on the server, and the browser uses a cookie to identify it on subsequent requests.

### University system feature status

**Implemented in the API:**

- Login, logout, and session status.
- Read the student profile, photo, academic record, and official average.
- Read exam options and schedules, payments, assessments, classes, and tutor reports.
- Read lecture schedule options and schedules using the available filters.
- Check service health and connectivity to the university system.

**Partial or not implemented:**

- Class selection programs and courses are partially available; submitting class selections is not implemented.
- The e-payment status endpoint is partial and its accuracy has not been verified; starting or completing payments is not implemented.
- Password changes are temporarily disabled, and union and military document uploads are not implemented; these endpoints return `501`.
- Assessments can be read, but starting an assessment or submitting answers is not implemented.
- Not all programs and cases have been verified against the live system, including populated exam schedules and some assessment states. An implemented endpoint is not guaranteed to work for every account.

### Documentation

A demo instance of the API is available at:

- **API URL:** [https://90bc-144-76-192-180.ngrok-free.app](https://90bc-144-76-192-180.ngrok-free.app)
- **Swagger:** [Browse and try the API](https://90bc-144-76-192-180.ngrok-free.app/api-docs/)
- **Service status:** [Health](https://90bc-144-76-192-180.ngrok-free.app/api/v1/health)

After starting the project, browse and try the API endpoints using Swagger at:

[http://localhost:4000/api-docs](http://localhost:4000/api-docs)

Most requests require signing in through the authentication endpoint first.

### Local setup

The project requires **Node.js 24 or later** and **npm**. From the project directory:

```bash
npm ci
npm run dev
```

The service runs at `http://localhost:4000` by default. See `.env.example` for available settings; pass environment variables to the running process, as the project does not load `.env` automatically.

In production, HTTPS must terminate at a reverse proxy: with `NODE_ENV=production` the session cookie is marked `Secure` and login will not work over plain HTTP. The local proxy must correctly forward `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For`; do not expose port 4000 directly. Password changes are temporarily disabled until the upstream success response can be reliably verified.

Let's Encrypt can issue trusted HTTPS certificates for a public IP without a domain. IP certificates require the `shortlived` profile, last about six days, and must be renewed automatically. The `webroot` example requires Certbot 5.4 or later and public access to port 80. Once Nginx serves the challenge path from your web root:

```bash
sudo certbot certonly --staging --preferred-profile shortlived --webroot --webroot-path /var/www/svu-app --ip-address YOUR_PUBLIC_IP
```

Replace the IP and directory with your values. A `--staging` certificate is for testing and is not browser-trusted; after testing, repeat without `--staging`. Configure Nginx manually with the `fullchain.pem` and `privkey.pem` paths reported by Certbot, set a deploy hook to reload Nginx after renewal, and test renewal with `sudo certbot renew --dry-run`. The old parent-directory `deploy/nginx.conf` is HTTP-only and is not a secure production configuration. See [Let's Encrypt's IP certificate guide](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/).

To run tests or build and start the production version:

```bash
npm test
npm run build
npm start
```
