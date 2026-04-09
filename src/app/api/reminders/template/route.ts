import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";

const TEMPLATE_CSV = `phone,name,bike_model,message_type,custom_message
03001234567,Ahmed Khan,CD70,oil_change,
03119876543,Ali Hassan,CG125,engine_tuning,
03215551234,Usman Raza,CB150F,,Eid Mubarak! Get 20% off on all services this week at Danish Honda Palace.`;

/**
 * GET /api/reminders/template
 * Download a CSV template for bulk reminder upload.
 */
export async function GET() {
  try {
    await requireAdmin();

    return new NextResponse(TEMPLATE_CSV, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="reminder-upload-template.csv"',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
