const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(cors());
app.use(express.json());

// MVP용 임시 메모리 DB
// 서버를 끄면 데이터는 사라짐
const farms = [
  { id: "farm-1", name: "청수리", areaMemo: "10정", memo: "주 농장" },
  { id: "farm-2", name: "양사리1", areaMemo: "4정", memo: "" },
  {
    id: "farm-3",
    name: "양사리2",
    areaMemo: "5~7정 식재",
    memo: "벌레 피해 체크 필요",
  },
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
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calcExpenseTotal(expenses = []) {
  return expenses.reduce((sum, expense) => {
    return sum + toNumber(expense.quantity) * toNumber(expense.unitPrice);
  }, 0);
}

function calcLaborTotal(workers = []) {
  return workers.reduce((sum, worker) => {
    return sum + toNumber(worker.count) * toNumber(worker.wagePerPerson);
  }, 0);
}

function enrichActivity(activity) {
  const laborTotal = calcLaborTotal(activity.workers);
  const expenseTotal = calcExpenseTotal(activity.expenses);
  const totalCost = laborTotal + expenseTotal;

  const harvestBags = toNumber(
    activity.fieldHarvestBags ?? activity.harvestBags
  );

  return {
    ...activity,
    laborTotal,
    expenseTotal,
    totalCost,
    costPerBag: harvestBags ? Math.round(totalCost / harvestBags) : 0,
  };
}

function enrichSale(sale) {
  const quantityBag = toNumber(sale.quantityBag);
  const pricePerBag = toNumber(sale.pricePerBag);

  return {
    ...sale,
    totalAmount: quantityBag * pricePerBag,
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "bam-farm-backend",
  });
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
    result = result.filter(
      (activity) => String(activity.year) === String(year)
    );
  }

  if (farmId) {
    result = result.filter((activity) => activity.farmId === farmId);
  }

  if (category) {
    result = result.filter((activity) => activity.category === category);
  }

  res.json(result.map(enrichActivity));
});

app.post("/api/activities", (req, res) => {
  const date = req.body.date;
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();

  const workers = Array.isArray(req.body.workers)
    ? req.body.workers
        .map((worker) => ({
          workerType: worker.workerType,
          count: toNumber(worker.count),
          wagePerPerson: toNumber(worker.wagePerPerson),
        }))
        .filter((worker) => worker.count > 0)
    : [];

  const expenses = Array.isArray(req.body.expenses)
    ? req.body.expenses
        .map((expense) => ({
          itemName: expense.itemName || "",
          quantity: toNumber(expense.quantity),
          unit: expense.unit || "",
          unitPrice: toNumber(expense.unitPrice),
        }))
        .filter((expense) => expense.itemName)
    : [];

  const fieldHarvestBags = toNumber(
    req.body.fieldHarvestBags ?? req.body.harvestBags
  );

  const activity = {
    id: uuidv4(),
    year,
    date,
    farmId: req.body.farmId,
    category: req.body.category,
    title: req.body.title || "",
    memo: req.body.memo || "",

    // 작업자 그룹별 인건비
    workers,

    // 현장 수확 가마
    fieldHarvestBags,

    // 기존 요약 계산 호환용
    harvestBags: fieldHarvestBags,

    // 선별 관련
    sortingStatus: req.body.sortingStatus || "NOT_SORTED",
    sortedBagCount: toNumber(req.body.sortedBagCount),
    saleBagWeightKg: toNumber(req.body.saleBagWeightKg),
    rejectMemo: req.body.rejectMemo || "",

    // 기존 필드 호환용
    bagWeightKg: toNumber(req.body.bagWeightKg),

    expenses,
  };

  activities.push(activity);

  res.status(201).json(enrichActivity(activity));
});

app.delete("/api/activities/:id", (req, res) => {
  const index = activities.findIndex(
    (activity) => activity.id === req.params.id
  );

  if (index === -1) {
    return res.status(404).json({
      message: "작업 기록을 찾을 수 없습니다.",
    });
  }

  activities.splice(index, 1);

  res.status(204).send();
});

app.get("/api/sales", (req, res) => {
  const { year, buyerType, farmId } = req.query;

  let result = sales;

  if (year) {
    result = result.filter((sale) => String(sale.year) === String(year));
  }

  if (buyerType) {
    result = result.filter((sale) => sale.buyerType === buyerType);
  }

  if (farmId) {
    result = result.filter((sale) => sale.farmId === farmId);
  }

  res.json(result.map(enrichSale));
});

app.post("/api/sales", (req, res) => {
  const date = req.body.date;
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();

  const saleMethod = req.body.saleMethod || "SAME_DAY";

  const sale = {
    id: uuidv4(),
    year,
    date,
    farmId: req.body.farmId,

    buyerType: req.body.buyerType || "기타",
    buyerName: req.body.buyerName || "",

    // SAME_DAY = 당일 미선별 판매
    // AFTER_SORTING = 선별 후 판매
    saleMethod,

    // FIELD_BAG = 현장 가마
    // SORTED_SALE_BAG = 선별 후 판매용 가마
    bagType:
      req.body.bagType ||
      (saleMethod === "AFTER_SORTING"
        ? "SORTED_SALE_BAG"
        : "FIELD_BAG"),

    quantityBag: toNumber(req.body.quantityBag),

    // 당일 미선별 판매면 0으로 저장
    bagWeightKg:
      saleMethod === "AFTER_SORTING"
        ? toNumber(req.body.bagWeightKg)
        : 0,

    pricePerBag: toNumber(req.body.pricePerBag),
    qualityMemo: req.body.qualityMemo || "",
    memo: req.body.memo || "",
  };

  sales.push(sale);

  res.status(201).json(enrichSale(sale));
});

app.get("/api/summary", (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());

  const yearActivities = activities
    .filter((activity) => activity.year === year)
    .map(enrichActivity);

  const yearSales = sales
    .filter((sale) => sale.year === year)
    .map(enrichSale);

  const totalCost = yearActivities.reduce(
    (sum, activity) => sum + activity.totalCost,
    0
  );

  const totalRevenue = yearSales.reduce(
    (sum, sale) => sum + sale.totalAmount,
    0
  );

  // 총 수확량은 현장 수확 가마 기준
  const totalHarvestBags = yearActivities.reduce(
    (sum, activity) =>
      sum + toNumber(activity.fieldHarvestBags ?? activity.harvestBags),
    0
  );

  const totalSoldBags = yearSales.reduce(
    (sum, sale) => sum + toNumber(sale.quantityBag),
    0
  );

  res.json({
    year,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    totalHarvestBags,
    totalSoldBags,

    // 현장 가마와 선별 판매용 가마가 섞일 수 있으니
    // 이 재고 수치는 현재는 참고용으로만 보면 됨
    stockBags: totalHarvestBags - totalSoldBags,

    averagePricePerBag: totalSoldBags
      ? Math.round(totalRevenue / totalSoldBags)
      : 0,
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Bam Farm backend running on http://localhost:${PORT}`);
});