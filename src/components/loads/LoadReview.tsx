"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoadData {
  grossPay: number;
  totalMiles: number;
  brokerName: string;
}

export default function LoadReview({ docUrl, initialData }: { docUrl: string, initialData: LoadData }) {
  const [formData, setFormData] = useState(initialData);

  const handleConfirm = () => {
    alert("Yük Başarıyla Onaylandı! Dashboard'a işleniyor... 🚛");
  };

  return (
    <Card className="overflow-hidden border-0 shadow-2xl bg-white rounded-2xl">
      <div className="flex flex-col lg:flex-row h-[750px]">
        {/* SOL: BELGE ÖNİZLEME */}
        <div className="flex-1 bg-slate-800 p-2 relative group">
          <iframe
            src={docUrl}
            className="w-full h-full rounded-lg border-0 shadow-lg bg-white"
            title="RateCon Preview"
          />
        </div>

        {/* SAĞ: VERİ ANALİZİ VE ONAY */}
        <div className="w-full lg:w-[380px] p-8 flex flex-col justify-between border-l border-slate-100">
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">DATA REVIEW</h3>
              <p className="text-sm text-slate-500 font-medium italic">Extraction verified by AI</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Gross Revenue</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-green-600 font-bold">$</span>
                  <Input
                    type="number"
                    className="pl-8 text-xl font-black text-green-600 bg-green-50/50 border-green-100"
                    value={formData.grossPay}
                    onChange={(e) => setFormData({...formData, grossPay: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Miles</label>
                <Input
                  className="font-bold text-slate-700 bg-slate-50/50"
                  value={formData.totalMiles}
                  onChange={(e) => setFormData({...formData, totalMiles: Number(e.target.value)})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Broker / Source</label>
                <Input
                  className="font-medium text-slate-700 bg-slate-50/50"
                  value={formData.brokerName}
                  onChange={(e) => setFormData({...formData, brokerName: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleConfirm}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl shadow-lg transition-all active:scale-95"
            >
              CONFIRM & SYNC ✅
            </Button>
            <Button variant="ghost" className="w-full text-slate-400 font-bold hover:text-red-500">
              Discard Draft
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}