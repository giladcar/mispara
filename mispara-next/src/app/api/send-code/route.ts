import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'נדרשת כתובת אימייל תקינה' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    // הגרלת קוד סודי בן 6 ספרות בשרת (הלקוח לא יכול לראות אותו בדפדפן)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // תוקף ל-10 דקות

    // שמירת הקוד הרנדומלי בענן תחת האימייל של הלקוח
    const otpRef = doc(db, 'barber_otps', cleanEmail);
    await setDoc(otpRef, {
      otpCode,
      otpExpiry,
      createdAt: Date.now()
    });

    // הגדרת שליחת המייל דרך Gmail
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'an.chess.mysterious@gmail.com',
        pass: 'hfyndmadneaffkge',
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: '"המספרה - קביעת תורים" <an.chess.mysterious@gmail.com>',
      to: cleanEmail,
      subject: `קוד האימות שלך למספרה: ${otpCode}`,
      text: `שלום, קוד האימות שלך לכניסה למערכת התורים של המספרה הוא: ${otpCode}. הקוד תקף ל-10 דקות.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #18181b; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a;">
          <h2 style="color: #f59e0b; margin-top: 0;">✂ ברוכים הבאים למספרה!</h2>
          <p style="font-size: 15px; line-height: 1.5; color: #d4d4d8;">קיבלנו בקשה להתחברות למערכת קביעת התורים עם כתובת המייל שלך.</p>
          <p style="font-size: 14px; color: #a1a1aa; margin-bottom: 8px;">קוד האימות החד-פעמי שלך הוא:</p>
          <div style="font-size: 28px; font-weight: bold; background: #09090b; padding: 14px 24px; display: inline-block; border-radius: 8px; color: #f59e0b; letter-spacing: 6px; border: 1px solid #3f3f46;">
            ${otpCode}
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #71717a;">הקוד תקף ל-10 דקות הקרובות. אם לא ביקשת קוד זה, תוכל להתעלם מהודעה זו.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'הקוד נשלח בהצלחה למייל!' });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ success: false, error: 'שגיאה בשליחת המייל: ' + error.message }, { status: 500 });
  }
}