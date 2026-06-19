const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// 처음 MVP라서 임시 메모리 DB 사용
// 나중에 PostgreSQL, DynamoDB, MySQL 등으로 교체하면 됨
const farms = [
  { id: "farm-1", name: "청수리", areaMemo: "10정", memo: "주 농장" },
  { id: "farm-2", name: "양사리1", areaMemo: "4정", memo: "" },
  { id: "farm-3", name: "양사리", areaMemo: "5~7정 식재", memo: "벌레 피해 체크 필요" },
];

const activities = [];
const sales = [];

const activityCategories = [
  "방제",
  "예초",
  "전지",
  "비료",
  "벌통",
  "수확",
  "출하",
  "식재",
  "장비수리",
  "기타",
];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function calcExpenseTotal(expenses = []) {
  return expenses.reduce((sum, item) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    return sum + quantity * unitPrice;
  }, 0);
}

function calcLaborTotal(workerCount, wagePerWorker) {
  return toNumber(workerCount) * toNumber(wagePerWorker);
}

function enrichActivity(activity) {
  const laborTotal = calcLaborTotal(activity.workerCount, activity.wagePerWorker);
  const expenseTotal = calcExpenseTotal(activity.expenses);
  const totalCost = laborTotal + expenseTotal;

  return {
    ...activity,
    laborTotal,
    expenseTotal,
    totalCost,
    costPerBag: activity.harvestBags ? Math.round(totalCost / activity.harvestBags) : 0,
  };
}

function enrichSale(sale) {
  const quantityBag = toNumber(sale.quantityBag);
  const pricePerBag = toNumber(sale.pricePerBag);
  const totalAmount = quantityBag * pricePerBag;

  return {
    ...sale,
    totalAmount,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "bam-farm-backend" });
});

app.get("/api/farms", (req, res) => {
  res.json(farms);
});

app.post("/api/farms", (req, res) => {
  const farm = {
    id: uuidv4(),
    name: req.body.name,
    areaMemo: req.body.areaMemo || "",
    memo: req.body.memo || "",
  };
  farms.push(farm);
  res.status(201).json(farm);
});

app.get("/api/activity-categories", (req, res) => {
  res.json(activityCategories);
});

app.get("/api/activities", (req, res) => {
  const { year, farmId, category } = req.query;

  let result = activities;

  if (year) {
    result = result.filter((a) => String(a.year) === String(year));
  }
  if (farmId) {
    result = result.filter((a) => a.farmId === farmId);
  }
  if (category) {
    result = result.filter((a) => a.category === category);
  }

  res.json(result.map(enrichActivity));
});

app.post("/api/activities", (req, res) => {
  const date = req.body.date;
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();

  const activity = {
    id: uuidv4(),
    year,
    date,
    farmId: req.body.farmId,
    category: req.body.category,
    title: req.body.title,
    memo: req.body.memo || "",

    // 작업자 정보는 고정 인원 관리보다는 당일 총 인원/일당 중심
    workerCount: toNumber(req.body.workerCount),
    wagePerWorker: toNumber(req.body.wagePerWorker),

    // 수확량은 kg이 아니라 가마 기준
    harvestBags: toNumber(req.body.harvestBags),
    bagWeightKg: toNumber(req.body.bagWeightKg || 40),

    // 농약, 비료, 점심, 간식, 예초비, 전지비, 묘목비 등
    expenses: Array.isArray(req.body.expenses) ? req.body.expenses : [],
  };

  activities.push(activity);
  res.status(201).json(enrichActivity(activity));
});

app.delete("/api/activities/:id", (req, res) => {
  const index = activities.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: "작업 기록을 찾을 수 없습니다." });
  }
  activities.splice(index, 1);
  res.status(204).send();
});

app.get("/api/sales", (req, res) => {
  const { year, buyerType, farmId } = req.query;
  let result = sales;

  if (year) {
    result = result.filter((s) => String(s.year) === String(year));
  }
  if (buyerType) {
    result = result.filter((s) => s.buyerType === buyerType);
  }
  if (farmId) {
    result = result.filter((s) => s.farmId === farmId);
  }

  res.json(result.map(enrichSale));
});

app.post("/api/sales", (req, res) => {
  const date = req.body.date;
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();

  const sale = {
    id: uuidv4(),
    year,
    date,
    farmId: req.body.farmId,
    buyerType: req.body.buyerType, // 유통업자, 농협, 산림조합
    buyerName: req.body.buyerName || "",
    quantityBag: toNumber(req.body.quantityBag),
    bagWeightKg: toNumber(req.body.bagWeightKg || 40),
    pricePerBag: toNumber(req.body.pricePerBag),
    qualityMemo: req.body.qualityMemo || "",
    memo: req.body.memo || "",
  };

  sales.push(sale);
  res.status(201).json(enrichSale(sale));
});

app.get("/api/summary", (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());

  const yearActivities = activities.filter((a) => a.year === year).map(enrichActivity);
  const yearSales = sales.filter((s) => s.year === year).map(enrichSale);

  const totalCost = yearActivities.reduce((sum, a) => sum + a.totalCost, 0);
  const totalRevenue = yearSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalHarvestBags = yearActivities.reduce((sum, a) => sum + toNumber(a.harvestBags), 0);
  const totalSoldBags = yearSales.reduce((sum, s) => sum + toNumber(s.quantityBag), 0);

  res.json({
    year,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    totalHarvestBags,
    totalSoldBags,
    stockBags: totalHarvestBags - totalSoldBags,
    averagePricePerBag: totalSoldBags ? Math.round(totalRevenue / totalSoldBags) : 0,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Bam Farm backend running on http://localhost:${PORT}`);
});
