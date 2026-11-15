import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'נדרשת כתובת אימייל תקינה' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const otpRef = doc(db, 'barber_otps', cleanEmail);
    await setDoc(otpRef, {
      otpCode,
      otpExpiry,
      createdAt: Date.now()
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'an.chess.mysterious@gmail.com',
        pass: 'hfyndmadneaffkge',
      },
    });

    const info = await transporter.sendMail({
      from: '"המספרה" <an.chess.mysterious@gmail.com>',
      replyTo: 'an.chess.mysterious@gmail.com',
      to: cleanEmail,
      subject: `קוד כניסה למספרה: ${otpCode}`,
      text: `שלום,\nקוד הכניסה החד-פעמי שלך למערכת התורים של המספרה הוא: ${otpCode}\nהקוד תקף ל-10 דקות.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 24px; background: #18181b; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a;">
          <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">✂ המספרה - קוד כניסה</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #d4d4d8;">היי, הנה הקוד החד-פעמי שלך להתחברות למערכת קביעת התורים:</p>
          <div style="font-size: 28px; font-weight: bold; background: #09090b; padding: 14px 24px; display: inline-block; border-radius: 8px; color: #f59e0b; letter-spacing: 6px; border: 1px solid #3f3f46; margin: 8px 0;">
            ${otpCode}
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #71717a;">הקוד תקף ל-10 דקות הקרובות.</p>
        </div>
      `,
    });

    if (info.rejected && info.rejected.length > 0) {
      return NextResponse.json({ success: false, error: 'שרת הדואר דחה את הכתובת שהוזנה' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'הקוד נשלח בהצלחה למייל!' });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ success: false, error: 'שגיאה בשליחת המייל: ' + error.message }, { status: 500 });
  }
}