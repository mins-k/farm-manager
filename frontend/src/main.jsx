import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API_BASE = "http://localhost:4000/api";

function money(value) {
  return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function App() {
  const [farms, setFarms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const [activityForm, setActivityForm] = useState({
    date: "",
    farmId: "farm-1",
    category: "수확",
    title: "",
    workerCount: 0,
    wagePerWorker: 0,
    harvestBags: 0,
    bagWeightKg: 40,
    memo: "",
  });

  const [expenseRows, setExpenseRows] = useState([
    { itemName: "점심값", quantity: 1, unit: "회", unitPrice: 0 },
    { itemName: "간식값", quantity: 1, unit: "회", unitPrice: 0 },
  ]);

  const [saleForm, setSaleForm] = useState({
    date: "",
    farmId: "farm-1",
    buyerType: "유통업자",
    buyerName: "",
    quantityBag: 0,
    bagWeightKg: 40,
    pricePerBag: 0,
    qualityMemo: "",
    memo: "",
  });

  async function loadData() {
    const [farmRes, activityRes, saleRes, summaryRes] = await Promise.all([
      fetch(`${API_BASE}/farms`),
      fetch(`${API_BASE}/activities?year=${year}`),
      fetch(`${API_BASE}/sales?year=${year}`),
      fetch(`${API_BASE}/summary?year=${year}`),
    ]);

    setFarms(await farmRes.json());
    setActivities(await activityRes.json());
    setSales(await saleRes.json());
    setSummary(await summaryRes.json());
  }

  useEffect(() => {
    loadData();
  }, [year]);

  function updateActivity(key, value) {
    setActivityForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSale(key, value) {
    setSaleForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateExpense(index, key, value) {
    setExpenseRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  }

  function addExpenseRow() {
    setExpenseRows((prev) => [
      ...prev,
      { itemName: "", quantity: 1, unit: "개", unitPrice: 0 },
    ]);
  }

  async function submitActivity(e) {
    e.preventDefault();

    await fetch(`${API_BASE}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...activityForm,
        expenses: expenseRows.filter((row) => row.itemName),
      }),
    });

    setActivityForm({
      date: "",
      farmId: "farm-1",
      category: "수확",
      title: "",
      workerCount: 0,
      wagePerWorker: 0,
      harvestBags: 0,
      bagWeightKg: 40,
      memo: "",
    });
    setExpenseRows([
      { itemName: "점심값", quantity: 1, unit: "회", unitPrice: 0 },
      { itemName: "간식값", quantity: 1, unit: "회", unitPrice: 0 },
    ]);

    loadData();
  }

  async function submitSale(e) {
    e.preventDefault();

    await fetch(`${API_BASE}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saleForm),
    });

    setSaleForm({
      date: "",
      farmId: "farm-1",
      buyerType: "유통업자",
      buyerName: "",
      quantityBag: 0,
      bagWeightKg: 40,
      pricePerBag: 0,
      qualityMemo: "",
      memo: "",
    });

    loadData();
  }

  const farmName = (id) => farms.find((farm) => farm.id === id)?.name || id;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Chestnut Farm ERP MVP</p>
          <h1>밤농장 장부</h1>
          <p>작업, 비용, 수확, 판매를 연도별로 기록하는 MVP입니다.</p>
        </div>

        <label className="year-box">
          조회 연도
          <input value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
      </header>

      {summary && (
        <section className="summary-grid">
          <Card title="총 비용" value={money(summary.totalCost)} />
          <Card title="총 매출" value={money(summary.totalRevenue)} />
          <Card title="순이익" value={money(summary.profit)} />
          <Card title="수확/판매/재고" value={`${summary.totalHarvestBags} / ${summary.totalSoldBags} / ${summary.stockBags}가마`} />
          <Card title="평균 판매가" value={`${money(summary.averagePricePerBag)} / 가마`} />
        </section>
      )}

      <section className="panel">
        <h2>작업 기록 추가</h2>
        <form onSubmit={submitActivity} className="form-grid">
          <Input label="날짜" type="date" value={activityForm.date} onChange={(v) => updateActivity("date", v)} />
          <Select label="농장" value={activityForm.farmId} onChange={(v) => updateActivity("farmId", v)} options={farms.map((f) => [f.id, f.name])} />
          <Select label="작업 종류" value={activityForm.category} onChange={(v) => updateActivity("category", v)} options={["방제","예초","전지","비료","벌통","수확","출하","식재","장비수리","기타"].map((v) => [v, v])} />
          <Input label="제목" value={activityForm.title} onChange={(v) => updateActivity("title", v)} placeholder="예: 청수리 1차 수확" />
          <Input label="작업자 수" type="number" value={activityForm.workerCount} onChange={(v) => updateActivity("workerCount", v)} />
          <Input label="1인 일당" type="number" value={activityForm.wagePerWorker} onChange={(v) => updateActivity("wagePerWorker", v)} />
          <Input label="수확량(가마)" type="number" value={activityForm.harvestBags} onChange={(v) => updateActivity("harvestBags", v)} />
          <Input label="1가마 kg" type="number" value={activityForm.bagWeightKg} onChange={(v) => updateActivity("bagWeightKg", v)} />
          <Textarea label="메모" value={activityForm.memo} onChange={(v) => updateActivity("memo", v)} />

          <div className="full">
            <div className="row-title">
              <h3>추가 비용</h3>
              <button type="button" onClick={addExpenseRow}>비용 추가</button>
            </div>

            {expenseRows.map((row, index) => (
              <div className="expense-row" key={index}>
                <input placeholder="항목명" value={row.itemName} onChange={(e) => updateExpense(index, "itemName", e.target.value)} />
                <input type="number" placeholder="수량" value={row.quantity} onChange={(e) => updateExpense(index, "quantity", e.target.value)} />
                <input placeholder="단위" value={row.unit} onChange={(e) => updateExpense(index, "unit", e.target.value)} />
                <input type="number" placeholder="단가" value={row.unitPrice} onChange={(e) => updateExpense(index, "unitPrice", e.target.value)} />
              </div>
            ))}
          </div>

          <button className="primary full">작업 기록 저장</button>
        </form>
      </section>

      <section className="panel">
        <h2>판매 기록 추가</h2>
        <form onSubmit={submitSale} className="form-grid">
          <Input label="날짜" type="date" value={saleForm.date} onChange={(v) => updateSale("date", v)} />
          <Select label="농장" value={saleForm.farmId} onChange={(v) => updateSale("farmId", v)} options={farms.map((f) => [f.id, f.name])} />
          <Select label="판매처 유형" value={saleForm.buyerType} onChange={(v) => updateSale("buyerType", v)} options={["유통업자", "농협", "산림조합", "기타"].map((v) => [v, v])} />
          <Input label="판매처 이름" value={saleForm.buyerName} onChange={(v) => updateSale("buyerName", v)} placeholder="예: 김OO 유통" />
          <Input label="판매 가마 수" type="number" value={saleForm.quantityBag} onChange={(v) => updateSale("quantityBag", v)} />
          <Input label="1가마 kg" type="number" value={saleForm.bagWeightKg} onChange={(v) => updateSale("bagWeightKg", v)} />
          <Input label="1가마 가격" type="number" value={saleForm.pricePerBag} onChange={(v) => updateSale("pricePerBag", v)} />
          <Input label="품질 메모" value={saleForm.qualityMemo} onChange={(v) => updateSale("qualityMemo", v)} placeholder="예: 상태 안 좋아 농협 판매" />
          <Textarea label="메모" value={saleForm.memo} onChange={(v) => updateSale("memo", v)} />
          <button className="primary full">판매 기록 저장</button>
        </form>
      </section>

      <section className="two-columns">
        <div className="panel">
          <h2>작업 기록</h2>
          <div className="list">
            {activities.map((a) => (
              <article className="item" key={a.id}>
                <strong>{a.date} · {farmName(a.farmId)} · {a.category}</strong>
                <p>{a.title || "제목 없음"}</p>
                <p>비용 {money(a.totalCost)} · 수확 {a.harvestBags}가마 · 1가마당 비용 {money(a.costPerBag)}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>판매 기록</h2>
          <div className="list">
            {sales.map((s) => (
              <article className="item" key={s.id}>
                <strong>{s.date} · {farmName(s.farmId)} · {s.buyerType}</strong>
                <p>{s.buyerName || "판매처 이름 없음"}</p>
                <p>{s.quantityBag}가마 × {money(s.pricePerBag)} = {money(s.totalAmount)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }) {
  return (
    <div className="card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label>
      {label}
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="full">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

createRoot(document.getElementById("root")).render(<App />);
