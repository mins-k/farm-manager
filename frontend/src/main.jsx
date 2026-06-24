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

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => `${n(v).toLocaleString("ko-KR")}원`;
const defaultWorkers = () => WORKER_TYPES.map((x) => ({ workerType: x.value, count: 0, wagePerPerson: x.defaultWage }));
const initialActivity = () => ({ date: "", farmId: "farm-1", category: "수확", title: "", fieldHarvestBags: 0, sortingStatus: "NOT_SORTED", sortedBagCount: 0, saleBagWeightKg: 45, rejectMemo: "", memo: "" });
const initialSale = () => ({ date: "", farmId: "farm-1", buyerType: "유통업자", buyerName: "", saleMethod: "SAME_DAY", bagType: "FIELD_BAG", quantityBag: 0, bagWeightKg: 45, pricePerBag: 0, qualityMemo: "", memo: "" });

function App() {
  const [tab, setTab] = useState("ledger");
  const [year, setYear] = useState(new Date().getFullYear());
  const [farms, setFarms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState(initialActivity());
  const [workers, setWorkers] = useState(defaultWorkers());
  const [expenses, setExpenses] = useState([{ itemName: "점심값", quantity: 1, unit: "회", unitPrice: 0 }, { itemName: "간식값", quantity: 1, unit: "회", unitPrice: 0 }]);
  const [sale, setSale] = useState(initialSale());

  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        fetch(`${API_BASE}/farms`), fetch(`${API_BASE}/activities?year=${year}`),
        fetch(`${API_BASE}/sales?year=${year}`), fetch(`${API_BASE}/summary?year=${year}`),
      ]);
      if (![a,b,c,d].every((r) => r.ok)) throw new Error();
      setFarms(await a.json()); setActivities(await b.json()); setSales(await c.json()); setSummary(await d.json());
    } catch { alert("백엔드가 실행 중인지 확인해 주세요."); }
  };
  useEffect(() => { load(); }, [year]);

  const farmName = (id) => farms.find((f) => f.id === id)?.name || id;
  const laborTotal = workers.reduce((s, w) => s + n(w.count) * n(w.wagePerPerson), 0);
  const isHarvest = activity.category === "수확";
  const sorted = isHarvest && activity.sortingStatus === "SORTED";
  const afterSorting = sale.saleMethod === "AFTER_SORTING";
  const setA = (k, v) => setActivity((p) => ({ ...p, [k]: v }));
  const setS = (k, v) => setSale((p) => ({ ...p, [k]: v }));

  async function saveActivity(e) {
    e.preventDefault();
    const payload = {
      ...activity,
      harvestBags: isHarvest ? n(activity.fieldHarvestBags) : 0,
      fieldHarvestBags: isHarvest ? n(activity.fieldHarvestBags) : 0,
      sortedBagCount: sorted ? n(activity.sortedBagCount) : 0,
      saleBagWeightKg: sorted ? n(activity.saleBagWeightKg) : 0,
      bagWeightKg: sorted ? n(activity.saleBagWeightKg) : 0,
      workers: workers.filter((w) => n(w.count) > 0).map((w) => ({ ...w, count: n(w.count), wagePerPerson: n(w.wagePerPerson) })),
      expenses: expenses.filter((x) => x.itemName).map((x) => ({ ...x, quantity: n(x.quantity), unitPrice: n(x.unitPrice) })),
    };
    const r = await fetch(`${API_BASE}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) return alert("작업 기록 저장에 실패했습니다.");
    setActivity(initialActivity()); setWorkers(defaultWorkers()); setExpenses([{ itemName: "점심값", quantity: 1, unit: "회", unitPrice: 0 }, { itemName: "간식값", quantity: 1, unit: "회", unitPrice: 0 }]); load();
  }

  async function saveSale(e) {
    e.preventDefault();
    const payload = { ...sale, quantityBag: n(sale.quantityBag), pricePerBag: n(sale.pricePerBag), bagWeightKg: afterSorting ? n(sale.bagWeightKg) : 0 };
    const r = await fetch(`${API_BASE}/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) return alert("판매 기록 저장에 실패했습니다.");
    setSale(initialSale()); load();
  }

  const tabs = [["ledger","장부"],["calendar","달력"],["sales","판매"],["report","보고서"]];
  return <main>
    <header className="hero"><div><p className="eyebrow">Chestnut Farm ERP MVP</p><h1>밤농장 장부</h1><p>작업·비용·수확·판매를 연도별로 기록합니다.</p></div><label className="year-box">조회 연도<input value={year} onChange={(e) => setYear(e.target.value)} /></label></header>
    <nav className="tab-nav">{tabs.map(([id,label]) => <button key={id} type="button" className={tab === id ? "tab-button active" : "tab-button"} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {tab === "ledger" && <>
      <section className="panel"><h2>작업 기록 추가</h2><form onSubmit={saveActivity} className="form-grid">
        <Input label="날짜" type="date" value={activity.date} onChange={(v) => setA("date",v)} /><Select label="농장" value={activity.farmId} onChange={(v) => setA("farmId",v)} options={farms.map((f) => [f.id,f.name])}/><Select label="작업 종류" value={activity.category} onChange={(v) => setA("category",v)} options={["방제","예초","전지","비료","벌통","수확","출하","식재","장비수리","기타"].map((x)=>[x,x])}/><Input label="제목" value={activity.title} onChange={(v) => setA("title",v)} placeholder="예: 청수리 1차 수확"/>
        {isHarvest && <div className="full harvest-section"><div className="row-title"><h3>수확 · 선별 기록</h3></div><div className="form-grid"><Input label="현장 수확 가마 수" type="number" value={activity.fieldHarvestBags} onChange={(v)=>setA("fieldHarvestBags",v)}/><Select label="선별 여부" value={activity.sortingStatus} onChange={(v)=>setA("sortingStatus",v)} options={[["NOT_SORTED","미선별 / 당일 판매 가능"],["SORTED","선별 완료"]]}/>{sorted && <><Input label="선별 후 판매용 가마 수" type="number" value={activity.sortedBagCount} onChange={(v)=>setA("sortedBagCount",v)}/><Input label="판매용 1가마 기준 무게(kg)" type="number" value={activity.saleBagWeightKg} onChange={(v)=>setA("saleBagWeightKg",v)}/><Textarea label="불량/제외 메모" value={activity.rejectMemo} onChange={(v)=>setA("rejectMemo",v)}/></>}</div></div>}
        <div className="full worker-section"><div className="row-title"><h3>인건비</h3><strong>총 인건비: {money(laborTotal)}</strong></div><div className="worker-grid">{workers.map((w) => { const info=WORKER_TYPES.find((x)=>x.value===w.workerType); return <div className="worker-row" key={w.workerType}><strong>{info.label}</strong><label>인원<input type="number" min="0" value={w.count} onChange={(e)=>setWorkers((p)=>p.map((x)=>x.workerType===w.workerType?{...x,count:e.target.value}:x))}/></label><label>1인 일당<input type="number" min="0" step="1000" value={w.wagePerPerson} onChange={(e)=>setWorkers((p)=>p.map((x)=>x.workerType===w.workerType?{...x,wagePerPerson:e.target.value}:x))}/></label><span>소계 {money(n(w.count)*n(w.wagePerPerson))}</span></div>})}</div></div>
        <Textarea label="메모" value={activity.memo} onChange={(v)=>setA("memo",v)}/>
        <div className="full"><div className="row-title"><h3>추가 비용</h3><button type="button" onClick={()=>setExpenses((p)=>[...p,{itemName:"",quantity:1,unit:"개",unitPrice:0}])}>비용 추가</button></div>{expenses.map((x,i)=><div className="expense-row" key={i}><input placeholder="항목명" value={x.itemName} onChange={(e)=>setExpenses((p)=>p.map((a,j)=>j===i?{...a,itemName:e.target.value}:a))}/><input type="number" placeholder="수량" value={x.quantity} onChange={(e)=>setExpenses((p)=>p.map((a,j)=>j===i?{...a,quantity:e.target.value}:a))}/><input placeholder="단위" value={x.unit} onChange={(e)=>setExpenses((p)=>p.map((a,j)=>j===i?{...a,unit:e.target.value}:a))}/><input type="number" placeholder="단가" value={x.unitPrice} onChange={(e)=>setExpenses((p)=>p.map((a,j)=>j===i?{...a,unitPrice:e.target.value}:a))}/><button type="button" onClick={()=>setExpenses((p)=>p.filter((_,j)=>j!==i))}>삭제</button></div>)}</div><button className="primary full">작업 기록 저장</button>
      </form></section>
      <section className="panel"><h2>작업 기록</h2><div className="list">{activities.length===0&&<p className="empty">아직 저장된 작업 기록이 없습니다.</p>}{activities.map((a)=><article className="item" key={a.id}><strong>{a.date} · {farmName(a.farmId)} · {a.category}</strong><p>{a.title||"제목 없음"}</p>{a.category==="수확"&&<p>현장 수확 {a.fieldHarvestBags??a.harvestBags??0}가마{a.sortingStatus==="SORTED"&&` · 선별 후 ${a.sortedBagCount||0}가마 (${a.saleBagWeightKg||0}kg 기준)`}</p>}<p>비용 {money(a.totalCost)} · 1가마당 비용 {money(a.costPerBag)}</p></article>)}</div></section>
    </>}

    {tab === "sales" && <>
      {summary&&<section className="summary-grid sales-summary-grid"><Card title="올해 총 판매액" value={money(summary.totalRevenue)}/><Card title="평균 판매가" value={`${money(summary.averagePricePerBag)} / 가마`}/><Card title="총 판매 가마" value={`${summary.totalSoldBags}가마`}/></section>}
      <section className="panel"><h2>판매 기록 추가</h2><form onSubmit={saveSale} className="form-grid"><Input label="판매일" type="date" value={sale.date} onChange={(v)=>setS("date",v)}/><Select label="농장" value={sale.farmId} onChange={(v)=>setS("farmId",v)} options={farms.map((f)=>[f.id,f.name])}/><Select label="판매처 유형" value={sale.buyerType} onChange={(v)=>setS("buyerType",v)} options={["유통업자","농협","산림조합","기타"].map((x)=>[x,x])}/><Input label="판매처 이름" value={sale.buyerName} onChange={(v)=>setS("buyerName",v)} placeholder="예: 김OO 유통"/><Select label="판매 방식" value={sale.saleMethod} onChange={(v)=>setSale((p)=>({...p,saleMethod:v,bagType:v==="AFTER_SORTING"?"SORTED_SALE_BAG":"FIELD_BAG"}))} options={[["SAME_DAY","당일 미선별 판매"],["AFTER_SORTING","선별 후 판매"]]}/><Input label={afterSorting?"판매용 가마 수":"현장 가마 수"} type="number" value={sale.quantityBag} onChange={(v)=>setS("quantityBag",v)}/>{afterSorting&&<Input label="판매용 1가마 기준 무게(kg)" type="number" value={sale.bagWeightKg} onChange={(v)=>setS("bagWeightKg",v)}/>}<Input label="1가마 가격" type="number" value={sale.pricePerBag} onChange={(v)=>setS("pricePerBag",v)}/><Input label="품질 메모" value={sale.qualityMemo} onChange={(v)=>setS("qualityMemo",v)} placeholder="예: 상태 안 좋아 농협 판매"/><Textarea label="메모" value={sale.memo} onChange={(v)=>setS("memo",v)}/><button className="primary full">판매 기록 저장</button></form></section>
      <section className="panel"><h2>판매 내역</h2><div className="list">{sales.length===0&&<p className="empty">아직 저장된 판매 기록이 없습니다.</p>}{sales.map((s)=><article className="item" key={s.id}><strong>{s.date} · {farmName(s.farmId)} · {s.buyerType}</strong><p>{s.buyerName||"판매처 이름 없음"}</p><p>{s.saleMethod==="AFTER_SORTING"?"선별 후 판매":"당일 미선별 판매"}{s.saleMethod==="AFTER_SORTING"&&` · ${s.bagWeightKg}kg 기준`}</p><p>{s.quantityBag}가마 × {money(s.pricePerBag)} = {money(s.totalAmount)}</p></article>)}</div></section>
    </>}

    {tab === "calendar" && <section className="panel"><h2>{year}년 달력</h2><p className="empty">지금은 준비 단계야. 다음에 사진처럼 월간 달력으로 만들면 돼.</p><div className="list">{[...activities.map((a)=>({date:a.date, text:`작업 · ${a.category} · ${farmName(a.farmId)} · 비용 ${money(a.totalCost)}`})),...sales.map((s)=>({date:s.date,text:`판매 · ${s.buyerType} · ${farmName(s.farmId)} · 매출 ${money(s.totalAmount)}`}))].sort((a,b)=>a.date.localeCompare(b.date)).map((x,i)=><article className="item" key={i}><strong>{x.date}</strong><p>{x.text}</p></article>)}</div></section>}
    {tab === "report" && <><section className="summary-grid">{summary&&<><Card title="총 비용" value={money(summary.totalCost)}/><Card title="총 매출" value={money(summary.totalRevenue)}/><Card title="순이익" value={money(summary.profit)}/><Card title="작업 기록 수" value={`${activities.length}건`}/><Card title="판매 기록 수" value={`${sales.length}건`}/></>}</section><section className="panel"><h2>보고서</h2><p className="empty">다음 단계에서 농장별·월별 비용/매출 차트를 추가하면 돼.</p></section></>}
  </main>;
}

function Input({label,value,onChange,type="text",placeholder=""}) { return <label>{label}<input type={type} value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)}/></label>; }
function Select({label,value,onChange,options}) { return <label>{label}<select value={value} onChange={(e)=>onChange(e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>; }
function Textarea({label,value,onChange}) { return <label className="full">{label}<textarea value={value} onChange={(e)=>onChange(e.target.value)}/></label>; }
function Card({title,value}) { return <div className="card"><span>{title}</span><strong>{value}</strong></div>; }

createRoot(document.getElementById("root")).render(<App />);
