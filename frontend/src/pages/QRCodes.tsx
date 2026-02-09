import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Table } from '../types';
import '../styles/QRCodes.css';

interface QRCodeData {
  tableNumber: number;
  url: string;
  qrCode: string;
}

const QRCodes: React.FC = () => {
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQRCodes();
  }, []);

  const loadQRCodes = async () => {
    try {
      setLoading(true);
      const tables = await api.getTables() as Table[];
      
      // Generate QR codes for all tables
      const qrCodePromises = tables.map((table: Table) =>
        api.getTableQRCode(table.table_number)
      );
      
      const codes = await Promise.all(qrCodePromises);
      setQrCodes(codes);
    } catch (error) {
      console.error('Error loading QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const printAll = () => {
    window.print();
  };

  const downloadQRCode = (tableNumber: number, dataUrl: string) => {
    const link = document.createElement('a');
    link.download = `table-${tableNumber}-qrcode.png`;
    link.href = dataUrl;
    link.click();
  };

  if (loading) {
    return (
      <div className="qrcodes-container">
        <div className="loading">Se încarcă Codurile QR...</div>
      </div>
    );
  }

  return (
    <div className="qrcodes-container">
      <header className="qrcodes-header">
        <h1>Coduri QR pentru Mese</h1>
        <div className="header-actions">
          <button className="print-btn" onClick={printAll}>
            Printează Toate
          </button>
        </div>
      </header>

      <div className="instructions no-print">
        <h3>Instrucțiuni:</h3>
        <ul>
          <li>Printează aceste coduri QR și plasează-le pe fiecare masă</li>
          <li>Clienții pot scana codul QR pentru a selecta automat masa lor</li>
          <li>Mai mulți clienți la aceeași masă vor avea sesiuni separate</li>
          <li>Fiecare cod QR indică spre: <code>http://localhost:3000/table/[număr]</code></li>
        </ul>
      </div>

      <div className="qrcodes-grid">
        {qrCodes.map((qrCode) => (
          <div key={qrCode.tableNumber} className="qrcode-card">
            <div className="qrcode-header">
              <h2>Masa {qrCode.tableNumber}</h2>
            </div>
            
            <div className="qrcode-image">
              <img src={qrCode.qrCode} alt={`Cod QR Masa ${qrCode.tableNumber}`} />
            </div>
            
            <div className="qrcode-footer">
              <p className="qrcode-url">{qrCode.url}</p>
              <button 
                className="download-btn no-print"
                onClick={() => downloadQRCode(qrCode.tableNumber, qrCode.qrCode)}
              >
                Descarcă
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QRCodes;
