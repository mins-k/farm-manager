import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API_BASE = "http://localhost:4000/api";

const WORKER_TYPES = [
  { value: "FOREIGN_MALE", label: "외국인 남자", defaultWage: 130000 },
  { value: "FOREIGN_FEMALE", label: "외국인 여자", defaultWage: 110000 },
  { value: "KOREAN_MALE", label: "한국인 남자", defaultWage: 150000 },
  { value: "KOREAN_FEMALE", label: "한국인 여자", defaultWage: 130000 },
];

const SALE_METHODS = {
  SAME_DAY: "당일 미선별 판매",
  AFTER_SORTING: "선별 후 판매",
};

function createDefaultWorkers() {
  return WORKER_TYPES.map((worker) => ({
    workerType: worker.value,
    count: 0,
    wagePerPerson: worker.defaultWage,
  }));
}

function createInitialActivityForm() {
  return {
    date: "",
    farmId: "farm-1",
    category: "수확",
    title: "",

    // 수확 직후 산에서 담은 현장 가마 수
    fieldHarvestBags: 0,

    // 선별 여부 / 선별 후 판매용 가마 정보
    sortingStatus: "NOT_SORTED",
    sortedBagCount: 0,
    saleBagWeightKg: 45,
    rejectMemo: "",

    memo: "",
  };
}

function createInitialSaleForm() {
  return {
    date: "",
    farmId: "farm-1",
    buyerType: "유통업자",
    buyerName: "",

    // 당일 미선별 판매 / 선별 후 판매
    saleMethod: "SAME_DAY",
    bagType: "FIELD_BAG",

    quantityBag: 0,
    bagWeightKg: 45,
    pricePerBag: 0,
    qualityMemo: "",
    memo: "",
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function App() {
  const [farms, setFarms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const [activityForm, setActivityForm] = useState(createInitialActivityForm());
  const [workers, setWorkers] = useState(createDefaultWorkers());

  const [expenseRows, setExpenseRows] = useState([
    { itemName: "점심값", quantity: 1, unit: "회", unitPrice: 0 },
    { itemName: "간식값", quantity: 1, unit: "회", unitPrice: 0 },
  ]);

  const [saleForm, setSaleForm] = useState(createInitialSaleForm());

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

  function updateWorker(workerType, key, value) {
    setWorkers((prev) =>
      prev.map((worker) =>
        worker.workerType === workerType ? { ...worker, [key]: value } : worker
      )
    );
  }

  function updateSale(key, value) {
    setSaleForm((prev) => ({ ...prev, [key]: value }));
  }

  function changeSaleMethod(saleMethod) {
    setSaleForm((prev) => ({
      ...prev,
      saleMethod,
      bagType: saleMethod === "SAME_DAY" ? "FIELD_BAG" : "SORTED_SALE_BAG",
    }));
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

  const laborTotal = workers.reduce(
    (sum, worker) =>
      sum + toNumber(worker.count) * toNumber(worker.wagePerPerson),
    0
  );

  const isHarvest = activityForm.category === "수확";
  const isSortedHarvest = isHarvest && activityForm.sortingStatus === "SORTED";
  const isAfterSortingSale = saleForm.saleMethod === "AFTER_SORTING";

  async function submitActivity(e) {
    e.preventDefault();

    const activeWorkers = workers
      .filter((worker) => toNumber(worker.count) > 0)
      .map((worker) => ({
        ...worker,
        count: toNumber(worker.count),
        wagePerPerson: toNumber(worker.wagePerPerson),
      }));

    await fetch(`${API_BASE}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...activityForm,

        // 기존 요약 API 호환용: 총 수확량은 현장 수확 가마로 저장
        harvestBags: isHarvest ? toNumber(activityForm.fieldHarvestBags) : 0,
        bagWeightKg: isSortedHarvest
          ? toNumber(activityForm.saleBagWeightKg)
          : 0,

        fieldHarvestBags: isHarvest
          ? toNumber(activityForm.fieldHarvestBags)
          : 0,
        sortedBagCount: isSortedHarvest
          ? toNumber(activityForm.sortedBagCount)
          : 0,
        saleBagWeightKg: isSortedHarvest
          ? toNumber(activityForm.saleBagWeightKg)
          : 0,

        workers: activeWorkers,
        expenses: expenseRows
          .filter((row) => row.itemName)
          .map((row) => ({
            ...row,
            quantity: toNumber(row.quantity),
            unitPrice: toNumber(row.unitPrice),
          })),
      }),
    });

    setActivityForm(createInitialActivityForm());
    setWorkers(createDefaultWorkers());
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
      body: JSON.stringify({
        ...saleForm,
        quantityBag: toNumber(saleForm.quantityBag),
        bagWeightKg: isAfterSortingSale
          ? toNumber(saleForm.bagWeightKg)
          : 0,
        pricePerBag: toNumber(saleForm.pricePerBag),
      }),
    });

    setSaleForm(createInitialSaleForm());
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
          <Card
            title="수확/판매/재고"
            value={`${summary.totalHarvestBags} / ${summary.totalSoldBags} / ${summary.stockBags}가마`}
          />
          <Card
            title="평균 판매가"
            value={`${money(summary.averagePricePerBag)} / 가마`}
          />
        </section>
      )}

      <section className="panel">
        <h2>작업 기록 추가</h2>

        <form onSubmit={submitActivity} className="form-grid">
          <Input label="날짜" type="date" value={activityForm.date} onChange={(v) => updateActivity("date", v)} />
          <Select label="농장" value={activityForm.farmId} onChange={(v) => updateActivity("farmId", v)} options={farms.map((f) => [f.id, f.name])} />
          <Select label="작업 종류" value={activityForm.category} onChange={(v) => updateActivity("category", v)} options={["방제", "예초", "전지", "비료", "벌통", "수확", "출하", "식재", "장비수리", "기타"].map((v) => [v, v])} />
          <Input label="제목" value={activityForm.title} onChange={(v) => updateActivity("title", v)} placeholder="예: 청수리 1차 수확" />

          {isHarvest && (
            <div className="full harvest-section">
              <div className="row-title">
                <h3>수확 · 선별 기록</h3>
              </div>

              <div className="form-grid">
                <Input
                  label="현장 수확 가마 수"
                  type="number"
                  value={activityForm.fieldHarvestBags}
                  onChange={(v) => updateActivity("fieldHarvestBags", v)}
                />

                <Select
                  label="선별 여부"
                  value={activityForm.sortingStatus}
                  onChange={(v) => updateActivity("sortingStatus", v)}
                  options={[
                    ["NOT_SORTED", "미선별 / 당일 판매 가능"],
                    ["SORTED", "선별 완료"],
                  ]}
                />

                {isSortedHarvest && (
                  <>
                    <Input
                      label="선별 후 판매용 가마 수"
                      type="number"
                      value={activityForm.sortedBagCount}
                      onChange={(v) => updateActivity("sortedBagCount", v)}
                    />
                    <Input
                      label="판매용 1가마 기준 무게(kg)"
                      type="number"
                      value={activityForm.saleBagWeightKg}
                      onChange={(v) => updateActivity("saleBagWeightKg", v)}
                    />
                  </>
                )}

                {isSortedHarvest && (
                  <Textarea
                    label="불량/제외 메모"
                    value={activityForm.rejectMemo}
                    onChange={(v) => updateActivity("rejectMemo", v)}
                  />
                )}
              </div>
            </div>
          )}

          <div className="full worker-section">
            <div className="row-title">
              <h3>인건비</h3>
              <strong>총 인건비: {money(laborTotal)}</strong>
            </div>

            <div className="worker-grid">
              {workers.map((worker) => {
                const info = WORKER_TYPES.find((item) => item.value === worker.workerType);
                const subtotal = toNumber(worker.count) * toNumber(worker.wagePerPerson);

                return (
                  <div className="worker-row" key={worker.workerType}>
                    <strong>{info?.label}</strong>

                    <label>
                      인원
                      <input
                        type="number"
                        min="0"
                        value={worker.count}
                        onChange={(e) => updateWorker(worker.workerType, "count", e.target.value)}
                      />
                    </label>

                    <label>
                      1인 일당
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={worker.wagePerPerson}
                        onChange={(e) => updateWorker(worker.workerType, "wagePerPerson", e.target.value)}
                      />
                    </label>

                    <span>소계 {money(subtotal)}</span>
                  </div>
                );
              })}
            </div>
          </div>

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

          <Select
            label="판매 방식"
            value={saleForm.saleMethod}
            onChange={changeSaleMethod}
            options={[
              ["SAME_DAY", SALE_METHODS.SAME_DAY],
              ["AFTER_SORTING", SALE_METHODS.AFTER_SORTING],
            ]}
          />

          <Input
            label={isAfterSortingSale ? "판매용 가마 수" : "현장 가마 수"}
            type="number"
            value={saleForm.quantityBag}
            onChange={(v) => updateSale("quantityBag", v)}
          />

          {isAfterSortingSale && (
            <Input
              label="판매용 1가마 기준 무게(kg)"
              type="number"
              value={saleForm.bagWeightKg}
              onChange={(v) => updateSale("bagWeightKg", v)}
            />
          )}

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

                {a.category === "수확" && (
                  <p>
                    현장 수확 {a.fieldHarvestBags ?? a.harvestBags ?? 0}가마
                    {a.sortingStatus === "SORTED" &&
                      ` · 선별 후 ${a.sortedBagCount || 0}가마 (${a.saleBagWeightKg || 0}kg 기준)`}
                  </p>
                )}

                <p>비용 {money(a.totalCost)} · 1가마당 비용 {money(a.costPerBag)}</p>
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
                <p>
                  {s.saleMethod === "AFTER_SORTING" ? "선별 후 판매" : "당일 미선별 판매"}
                  {s.saleMethod === "AFTER_SORTING" && ` · ${s.bagWeightKg}kg 기준`}
                </p>
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
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
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
