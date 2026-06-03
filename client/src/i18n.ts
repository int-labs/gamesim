import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18next
// We don't load hardcoded static JSONs here because the translations
// will be dynamically injected from the backend SimulationType model.
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: {
          Decisions: "Decisions",
        }, // Base empty English. Our strings in code will be the fallback keys.
      },
      id: {
        translation: {
          Revenue: "Omset",
          Profit: "Profit",
          ESAT: "ESAT",
          CSAT: "CSAT",
          "Market Share": "Pangsa Pasar",
          "Products Updated": "Produk Diperbarui",
          "Confirm Product Unlock": "Konfirmasi Pembukaan Produk",
          "Unlock Cost": "Biaya Pembukaan",
          Unlock: "Buka",
          Cancel: "Batal",
          "Log Out": "Keluar",
          Enterprise: "Perusahaan",
          Analysis: "Analisis",
          "COMPANY LEVEL": "TINGKAT PERUSAHAAN",
          Products: "Produk",
          Segment: "Segmen",
          Global: "Global",
          Submit: "Kirim",
          Save: "Simpan",
          "Loading...": "Memuat...",
          "Next Round": "Ronde Berikutnya",
          Decision: "Keputusan",
          Decisions: "Keputusan",
          Report: "Laporan",
          "Product Locked": "Produk Dikunci",
          "Unlock Product": "Buka Produk",
          "Requirements are not met.": "Ketentuan belum terpenuhi.",
          "Product Configuration": "Konfigurasi Produk",
          "These settings apply to all subproducts":
            "Pengaturan ini berlaku untuk semua sub-produk",
          "Set Your Decision Inputs": "Atur Keputusan Anda",
          "Expected Charge-Offs on New {{productName}}s":
            "Perkiraan Penghapusan Pinjaman pada {{productName}} Baru",
          "Current Number of people:": "Jumlah orang saat ini:",
          "Estimated churn:": "Perkiraan churn:",
          "Total people end of year:": "Total orang di akhir tahun:",
          Past: "Sebelum",
          Average: "Rata-rata",
          "Select your Initiatives": "Pilih Inisiatif Anda",
          INITIATIVE: "INISIATIF",
          DESCRIPTION: "DESKRIPSI",
          COST: "BIAYA",
          "You can't select more than 3 initiatives.":
            "Anda tidak bisa memilih lebih dari 3 inisiatif.",
          "This initiative was already chosen in a previous round.":
            "Inisiatif ini sudah dipilih pada ronde sebelumnya.",
          "Initiatives History": "Riwayat Inisiatif",
          ROUND: "RONDE",
          "DATE & TIME": "TANGGAL & WAKTU",
          INITIATIVES: "INISIATIF",
          "No initiatives history available":
            "Tidak ada riwayat inisiatif yang tersedia",
          "N/A": "N/A",
          Bn: "M",
          "Total Revenue across the company":
            "Total Pendapatan di seluruh perusahaan",
          "Total Revenue across the chosen segment":
            "Total Pendapatan di seluruh segmen yang dipilih",
          "Total Risk Adjusted Profit across the company":
            "Total Laba Disesuaikan Risiko di seluruh perusahaan",
          "Total Risk Adjusted Profit across the chosen segment":
            "Total Laba Disesuaikan Risiko di seluruh segmen yang dipilih",
          "Customer Satisfaction score (CSAT) across the company":
            "Skor Kepuasan Pelanggan (CSAT) di seluruh perusahaan",
          "Customer Satisfaction score (CSAT) across the chosen segment":
            "Skor Kepuasan Pelanggan (CSAT) di seluruh segmen yang dipilih",
          "Employee Satisfaction score (ESAT) across the company":
            "Skor Kepuasan Karyawan (ESAT) di seluruh perusahaan",
          "Employee Satisfaction score (ESAT) across the chosen segment":
            "Skor Kepuasan Karyawan (ESAT) di seluruh segmen yang dipilih",
          CHOICE: "PILIHAN",
          "Business Performance": "Kinerja Bisnis",
          PnL: "Laba Rugi",
          "Balance Sheet": "Neraca Keuangan",
          "Cash Flow": "Arus Kas",
          "COMPANY LEVEL DECISION": "KEPUTUSAN TINGKAT PERUSAHAAN",
          "Edit Team Details": "Edit Detail Tim",
          "You can update the team details. These changes will be reflected across the simulation interface.":
            "Anda dapat memperbarui detail tim. Perubahan ini akan tercermin di seluruh antarmuka simulasi.",
          "Profile Photo": "Foto Profil",
          "Uploading...": "Mengunggah...",
          "Change Photo": "Ubah Foto",
          Delete: "Hapus",
          "Team Name": "Nama Tim",
          "Team Name cannot be empty": "Nama Tim tidak boleh kosong",
          "Team Leader": "Ketua Tim",
          "Team Leader cannot be empty": "Ketua Tim tidak boleh kosong",
          Round: "Ronde",
          // --- Bizperf labels ---
          "Total Number of Accounts": "Total Jumlah Akun",
          "Average Loans": "Rata-rata Pinjaman",
          "Average Credits": "Rata-rata Kredit",
          "Transaction Processed": "Transaksi Diproses",
          "Cost to Income Ratio": "Rasio Biaya terhadap Pendapatan",
          "Loan to Deposit Ratio (Aggregated)":
            "Rasio Pinjaman terhadap Simpanan (Agregat)",
          "Non Performing Loan (Aggregated)": "Kredit Bermasalah (Agregat)",
          "Account Acquisition Cost": "Biaya Akuisisi Akun",
          "Revenue Per Account": "Pendapatan per Akun",
          "No performance data available for this level.":
            "Tidak ada data kinerja yang tersedia untuk level ini.",
          "YoY Change": "Perubahan YoY",
          // --- PnL labels ---
          "Interest Income": "Pendapatan Bunga",
          "Interest Expense": "Beban Bunga",
          "Net Interest Income": "Pendapatan Bunga Bersih",
          "Fees Income": "Pendapatan Biaya",
          "Other Non-Interest Income Total":
            "Total Pendapatan Non-Bunga Lainnya",
          "Non-Interest Income": "Pendapatan Non-Bunga",
          "Total Revenue": "Total Pendapatan",
          "Staff Costs": "Biaya Karyawan",
          "Other Operating Expenses": "Beban Operasional Lainnya",
          "Total Expenses": "Total Beban",
          Provisions: "Provisi",
          "Profit Before Tax": "Laba Sebelum Pajak",
          "Income Tax Expense": "Beban Pajak Penghasilan",
          "Profit After Tax": "Laba Setelah Pajak",
          "Capital Charge": "Biaya Modal",
          "Risk Adjusted Profit": "Laba Disesuaikan Risiko",
          Dividends: "Dividen",
          "Retained Earnings": "Laba Ditahan",
          // --- Balance Sheet group headers ---
          Assets: "Aset",
          Liabilities: "Kewajiban",
          Equity: "Ekuitas",
          Others: "Lainnya",
          // --- Cash Flow group headers ---
          "Operating Activities": "Aktivitas Operasional",
          "Investing Activities": "Aktivitas Investasi",
          "Financing Activities": "Aktivitas Pendanaan",
          General: "Umum",
          // --- Balance Sheet row items ---
          "Cash and Cash Equivalents": "Kas dan Setara Kas",
          "Loans and Advances to Customers":
            "Pinjaman dan Uang Muka kepada Nasabah",
          Investments: "Investasi",
          "Fixed Assets": "Aset Tetap",
          "Other Assets": "Aset Lainnya",
          "Total Assets": "Total Aset",
          "Customer Deposits": "Simpanan Nasabah",
          Borrowings: "Pinjaman",
          "Total liabilities": "Total Kewajiban",
          "Share capital": "Modal Saham",
          "Retained earnings": "Laba Ditahan",
          Reserves: "Cadangan",
          "Other equity instruments": "Instrumen Ekuitas Lainnya",
          "Total equity": "Total Ekuitas",
          // --- Cash Flow row items ---
          "Depreciation/Amortization": "Depresiasi/Amortisasi",
          "Change in Working Capital": "Perubahan Modal Kerja",
          "Strategic Operating Investments": "Investasi Operasional Strategis",
          "Net Change in Customer Deposits":
            "Perubahan Bersih Simpanan Nasabah",
          "Net Change in Loans & Advances to Customers":
            "Perubahan Bersih Pinjaman & Uang Muka kepada Nasabah",
          "Tax Paid": "Pajak Dibayar",
          "Capital Expenditures": "Belanja Modal",
          "ATM Deployment/Disposal": "Penempatan/Pelepasan ATM",
          "Investment Changes": "Perubahan Investasi",
          "Debt Issuance/Repayment": "Penerbitan/Pelunasan Utang",
          "Equity Transactions": "Transaksi Ekuitas",
          "Dividend Paid": "Dividen Dibayar",
          // --- Chart labels ---
          Account: "Akun",
          "Number of Accounts": "Jumlah<1/>Akun",
          "Current accounts": "Akun yang Ada",
          "New accounts": "Akun Baru",
          "Number of customers": "Jumlah Nasabah",
          "Charge-off rate": "Tingkat Penghapusan",
          Previous: "Sebelumnya",
        },
      },
      th: {
        translation: {
          Revenue: "รายได้",
          Profit: "กำไร",
          ESAT: "ความพึงพอใจของพนักงาน",
          CSAT: "CSAT",
          "Market Share": "ส่วนแบ่งการตลาด",
          "Products Updated": "อัปเดตผลิตภัณฑ์แล้ว",
          "Confirm Product Unlock": "ยืนยันการปลดล็อกผลิตภัณฑ์",
          "Unlock Cost": "ค่าใช้จ่ายในการปลดล็อก",
          Unlock: "ปลดล็อก",
          Cancel: "ยกเลิก",
          "Log Out": "ออกจากระบบ",
          Enterprise: "องค์กร",
          Analysis: "การวิเคราะห์",
          "COMPANY LEVEL": "ระดับบริษัท",
          Products: "ผลิตภัณฑ์",
          Segment: "กลุ่มลูกค้า",
          Global: "ระดับโลก",
          Submit: "ส่งคำตอบ",
          Save: "บันทึก",
          "Loading...": "กำลังโหลด...",
          "Next Round": "รอบถัดไป",
          Decision: "การตัดสินใจ",
          Decisions: "การตัดสินใจ",
          Report: "รายงาน",
          "Product Locked": "ผลิตภัณฑ์ถูกล็อก",
          "Unlock Product": "ปลดล็อกผลิตภัณฑ์",
          "Requirements are not met.": "ข้อกำหนดไม่ตรงกัน.",
          "Product Configuration": "การกำหนดค่าผลิตภัณฑ์",
          "These settings apply to all subproducts":
            "การตั้งค่านี้ใช้กับผลิตภัณฑ์ย่อยทั้งหมด",
          "Set Your Decision Inputs": "ตั้งค่าข้อมูลการตัดสินใจของคุณ",
          "Expected Charge-Offs on New {{productName}}s":
            "คาดการณ์การตัดหนี้สูญสำหรับ {{productName}} ใหม่",
          "Current Number of people:": "จำนวนคนปัจจุบัน:",
          "Estimated churn:": "คาดการณ์การลาออก:",
          "Total people end of year:": "จำนวนคนทั้งหมดเมื่อสิ้นปี:",
          Past: "อดีต",
          Average: "ค่าเฉลี่ย",
          "Select your Initiatives": "เลือกโครงการของคุณ",
          INITIATIVE: "โครงการ",
          DESCRIPTION: "รายละเอียด",
          COST: "ต้นทุน",
          "You can't select more than 3 initiatives.":
            "คุณไม่สามารถเลือกได้เกิน 3 โครงการ.",
          "This initiative was already chosen in a previous round.":
            "โครงการนี้ได้ถูกเลือกไปแล้วในรอบก่อนหน้า.",
          "Initiatives History": "ประวัติโครงการ",
          ROUND: "รอบที่",
          "DATE & TIME": "วันที่และเวลา",
          INITIATIVES: "โครงการ",
          "No initiatives history available": "ไม่มีประวัติโครงการ",
          // "N/A": "ไม่มีข้อมูล",
          "N/A": "N/A",
          Bn: "พันล้าน",
          "Total Revenue across the company": "รายได้รวมทั่วทั้งบริษัท",
          "Total Revenue across the chosen segment":
            "รายได้รวมในกลุ่มเป้าหมายที่เลือก",
          "Total Risk Adjusted Profit across the company":
            "กำไรที่ปรับความเสี่ยงแล้วรวมทั่วทั้งบริษัท",
          "Total Risk Adjusted Profit across the chosen segment":
            "กำไรที่ปรับความเสี่ยงแล้วรวมในกลุ่มเป้าหมายที่เลือก",
          "Customer Satisfaction score (CSAT) across the company":
            "คะแนนความพึงพอใจของลูกค้า (CSAT) ทั่วทั้งบริษัท",
          "Customer Satisfaction score (CSAT) across the chosen segment":
            "คะแนนความพึงพอใจของลูกค้า (CSAT) ในกลุ่มเป้าหมายที่เลือก",
          "Employee Satisfaction score (ESAT) across the company":
            "คะแนนความพึงพอใจของพนักงาน (ESAT) ทั่วทั้งบริษัท",
          "Employee Satisfaction score (ESAT) across the chosen segment":
            "คะแนนความพึงพอใจของพนักงาน (ESAT) ในกลุ่มเป้าหมายที่เลือก",
          CHOICE: "ตัวเลือก",
          "Business Performance": "ผลประกอบการทางธุรกิจ",
          PnL: "กำไรขาดทุน",
          "Balance Sheet": "งบดุล",
          "Cash Flow": "กระแสเงินสด",
          "COMPANY LEVEL DECISION": "การตัดสินใจระดับบริษัท",
          "Edit Team Details": "แก้ไขรายละเอียดทีม",
          "You can update the team details. These changes will be reflected across the simulation interface.":
            "คุณสามารถอัปเดตรายละเอียดของทีม การเปลี่ยนแปลงเหล่านี้จะปรากฏในส่วนต่างๆ ของอินเทอร์เฟซแบบจำลอง",
          "Profile Photo": "รูปโปรไฟล์",
          "Uploading...": "กำลังอัปโหลด...",
          "Change Photo": "เปลี่ยนรูปภาพ",
          Delete: "ลบ",
          "Team Name": "ชื่อทีม",
          "Team Name cannot be empty": "ชื่อทีมต้องไม่ว่างเปล่า",
          "Team Leader": "หัวหน้าทีม",
          "Team Leader cannot be empty": "หัวหน้าทีมต้องไม่ว่างเปล่า",
          Round: "รอบ",
          // --- Bizperf labels ---
          "Total Number of Accounts": "จำนวนบัญชีทั้งหมด",
          "Average Loans": "สินเชื่อเฉลี่ย",
          "Average Credits": "เครดิตเฉลี่ย",
          "Transaction Processed": "ธุรกรรมที่ประมวลผล",
          "Cost to Income Ratio": "อัตราส่วนต้นทุนต่อรายได้",
          "Loan to Deposit Ratio (Aggregated)":
            "อัตราส่วนสินเชื่อต่อเงินฝาก (รวม)",
          "Non Performing Loan (Aggregated)": "สินเชื่อด้อยคุณภาพ (รวม)",
          "Account Acquisition Cost": "ต้นทุนการได้มาซึ่งบัญชี",
          "Revenue Per Account": "รายได้ต่อบัญชี",
          "No performance data available for this level.":
            "ไม่มีข้อมูลผลการดำเนินงานสำหรับระดับนี้",
          "YoY Change": "การเปลี่ยนแปลง YoY",
          // --- PnL labels ---
          "Interest Income": "รายได้ดอกเบี้ย",
          "Interest Expense": "ค่าใช้จ่ายดอกเบี้ย",
          "Net Interest Income": "รายได้ดอกเบี้ยสุทธิ",
          "Fees Income": "รายได้ค่าธรรมเนียม",
          "Other Non-Interest Income Total": "รายได้ที่ไม่ใช่ดอกเบี้ยอื่นๆ รวม",
          "Non-Interest Income": "รายได้ที่ไม่ใช่ดอกเบี้ย",
          "Total Revenue": "รายได้รวม",
          "Staff Costs": "ค่าใช้จ่ายพนักงาน",
          "Other Operating Expenses": "ค่าใช้จ่ายในการดำเนินงานอื่นๆ",
          "Total Expenses": "ค่าใช้จ่ายรวม",
          Provisions: "เงินสำรอง",
          "Profit Before Tax": "กำไรก่อนภาษี",
          "Income Tax Expense": "ค่าใช้จ่ายภาษีเงินได้",
          "Profit After Tax": "กำไรหลังภาษี",
          "Capital Charge": "ค่าใช้จ่ายทุน",
          "Risk Adjusted Profit": "กำไรที่ปรับความเสี่ยงแล้ว",
          Dividends: "เงินปันผล",
          "Retained Earnings": "กำไรสะสม",
          // --- Balance Sheet group headers ---
          Assets: "สินทรัพย์",
          Liabilities: "หนี้สิน",
          Equity: "ส่วนของผู้ถือหุ้น",
          Others: "อื่นๆ",
          // --- Cash Flow group headers ---
          "Operating Activities": "กิจกรรมดำเนินงาน",
          "Investing Activities": "กิจกรรมการลงทุน",
          "Financing Activities": "กิจกรรมการจัดหาเงิน",
          General: "ทั่วไป",
          // --- Balance Sheet row items ---
          "Cash and Cash Equivalents": "เงินสดและรายการเทียบเท่าเงินสด",
          "Loans and Advances to Customers": "สินเชื่อและเงินทดรองแก่ลูกค้า",
          Investments: "เงินลงทุน",
          "Fixed Assets": "สินทรัพย์ถาวร",
          "Other Assets": "สินทรัพย์อื่นๆ",
          "Total Assets": "สินทรัพย์รวม",
          "Customer Deposits": "เงินฝากของลูกค้า",
          Borrowings: "เงินกู้ยืม",
          "Total liabilities": "หนี้สินรวม",
          "Share capital": "ทุนเรือนหุ้น",
          "Retained earnings": "กำไรสะสม",
          Reserves: "เงินสำรอง",
          "Other equity instruments": "ตราสารทุนอื่นๆ",
          "Total equity": "ส่วนของผู้ถือหุ้นรวม",
          // --- Cash Flow row items ---
          "Depreciation/Amortization": "ค่าเสื่อมราคา/ค่าตัดจำหน่าย",
          "Change in Working Capital": "การเปลี่ยนแปลงเงินทุนหมุนเวียน",
          "Strategic Operating Investments":
            "การลงทุนเชิงกลยุทธ์ในการดำเนินงาน",
          "Net Change in Customer Deposits":
            "การเปลี่ยนแปลงสุทธิในเงินฝากของลูกค้า",
          "Net Change in Loans & Advances to Customers":
            "การเปลี่ยนแปลงสุทธิในสินเชื่อและเงินทดรองแก่ลูกค้า",
          "Tax Paid": "ภาษีที่จ่าย",
          "Capital Expenditures": "รายจ่ายลงทุน",
          "ATM Deployment/Disposal": "การติดตั้ง/จำหน่ายตู้ ATM",
          "Investment Changes": "การเปลี่ยนแปลงการลงทุน",
          "Debt Issuance/Repayment": "การออก/ชำระหนี้",
          "Equity Transactions": "ธุรกรรมทุน",
          "Dividend Paid": "เงินปันผลที่จ่าย",
          // --- Chart labels ---
          Account: "บัญชี",
          "Number of Accounts": "จำนวน<1/>บัญชี",
          "Current accounts": "บัญชีปัจจุบัน",
          "New accounts": "บัญชีใหม่",
          "Number of customers": "จำนวนลูกค้า",
          "Charge-off rate": "อัตราการตัดหนี้สูญ",
          Previous: "ก่อนหน้า",
          "Annual Budget Allocation": "การจัดสรรงบประมาณประจำปี",
          "Manage your total funds across both semesters.":
            "จัดสรรงบประมาณทั้งหมดของคุณสำหรับทั้ง 2 ช่วงเวลา",
          "Semester 1": "ช่วงที่ 1",
          "Semester 2": "ช่วงที่ 2",
          "Remaining budget for this semester": "งบประมาณที่เหลือสำหรับช่วงนี้",
        },
      },
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    react: {
      useSuspense: false, // Prevents crashes if no <Suspense> boundary exists
    },
  });

export default i18n;
