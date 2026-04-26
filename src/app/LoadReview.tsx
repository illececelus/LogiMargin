import React from 'react';
import LoadReview from '../components/LoadReview';

export default function Home() {
  const currentDocUrl = "https://nqtcnogiswpmvcnmdfer.supabase.co/storage/v1/object/sign/logistics_docs/Rate%20Con%20130733%20(209).pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84NGQxNTY1ZS05MTQ4LTRiNjUtOTk4YS1kYjg4ZTllM2IzNjQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dpc3RpY3NfZG9jcy9SYXRlIENvbiAxMzA3MzMgKDIwOSkucGRmIiwiaWF0IjoxNzc3MTg4NzU2LCJleHAiOjE3Nzc3OTM1NTZ9.BFxK0FR1_ViNBTHk_SJao8rLKAOYFV9t2DZ8blT0xvc";

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              LOGIMARGIN <span className="text-blue-600 text-sm italic font-medium">v4.0 PRO</span>
            </h1>
            <p className="text-slate-500 font-medium tracking-tight">Denton, TX | Operations Hub</p>
          </div>
          <div className="text-right">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              System Active
            </span>
          </div>
        </div>

        {/* Dashboard Content */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Pending Load Approval</h2>
          </div>

          <LoadReview
            docUrl={currentDocUrl}
            initialData={{
              grossPay: 1250,
              totalMiles: 480,
              brokerName: "TQL (RC#130733)"
            }}
          />
        </section>

      </div>
    </main>
  );
}