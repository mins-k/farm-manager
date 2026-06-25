require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const FARMS_TABLE = process.env.DYNAMODB_FARMS_TABLE || "bam-farms";
const ACTIVITIES_TABLE =
  process.env.DYNAMODB_ACTIVITIES_TABLE || "bam-activities";
const SALES_TABLE = process.env.DYNAMODB_SALES_TABLE || "bam-sales";

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-northeast-2",
});

const db = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const activityCategories = [
  "방제",
  "예초",
  "전지",
  "비료",
  "수확",
  "밤작업",
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

async function scanAll(tableName) {
  let items = [];
  let lastEvaluatedKey;

  do {
    const result = await db.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    items = [...items, ...(result.Items || [])];
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function ensureDefaultFarms() {
  const farms = await scanAll(FARMS_TABLE);

  if (farms.length > 0) {
    return;
  }

  const defaultFarms = [
    {
      id: "farm-1",
      name: "청수리",
      areaMemo: "10정",
      memo: "주 농장",
    },
    {
      id: "farm-2",
      name: "양사리1",
      areaMemo: "4정",
      memo: "",
    },
    {
      id: "farm-3",
      name: "양사리2",
      areaMemo: "5~7정 식재",
      memo: "벌레 피해 체크 필요",
    },
  ];

  await Promise.all(
    defaultFarms.map((farm) =>
      db.send(
        new PutCommand({
          TableName: FARMS_TABLE,
          Item: farm,
        })
      )
    )
  );

  console.log("기본 농장 데이터 생성 완료");
}

app.get("/api/health", async (req, res) => {
  try {
    await db.send(
      new ScanCommand({
        TableName: FARMS_TABLE,
        Limit: 1,
      })
    );

    res.json({
      ok: true,
      service: "bam-farm-backend",
      database: "DynamoDB connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "bam-farm-backend",
      database: "DynamoDB connection failed",
      message: error.message,
    });
  }
});

app.get("/api/farms", async (req, res) => {
  try {
    const farms = await scanAll(FARMS_TABLE);

    farms.sort((a, b) => a.name.localeCompare(b.name, "ko"));

    res.json(farms);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "농장 목록을 불러오지 못했습니다.",
    });
  }
});

app.post("/api/farms", async (req, res) => {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({
        message: "농장 이름은 필수입니다.",
      });
    }

    const farm = {
      id: uuidv4(),
      name: req.body.name.trim(),
      areaMemo: req.body.areaMemo || "",
      memo: req.body.memo || "",
      createdAt: new Date().toISOString(),
    };

    await db.send(
      new PutCommand({
        TableName: FARMS_TABLE,
        Item: farm,
      })
    );

    res.status(201).json(farm);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "농장 저장에 실패했습니다.",
    });
  }
});

app.get("/api/activity-categories", (req, res) => {
  res.json(activityCategories);
});

app.get("/api/activities", async (req, res) => {
  try {
    const { year, farmId, category } = req.query;

    let activities = await scanAll(ACTIVITIES_TABLE);

    if (year) {
      activities = activities.filter(
        (activity) => String(activity.year) === String(year)
      );
    }

    if (farmId) {
      activities = activities.filter((activity) => activity.farmId === farmId);
    }

    if (category) {
      activities = activities.filter(
        (activity) => activity.category === category
      );
    }

    activities.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json(activities.map(enrichActivity));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "작업 기록을 불러오지 못했습니다.",
    });
  }
});

app.post("/api/activities", async (req, res) => {
  try {
    const date = req.body.date;

    if (!date) {
      return res.status(400).json({
        message: "작업 날짜는 필수입니다.",
      });
    }

    const year = Number(date.slice(0, 4));

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

      workers,

      fieldHarvestBags,
      harvestBags: fieldHarvestBags,

      sortingStatus: req.body.sortingStatus || "NOT_SORTED",
      sortedBagCount: toNumber(req.body.sortedBagCount),
      saleBagWeightKg: toNumber(req.body.saleBagWeightKg),
      rejectMemo: req.body.rejectMemo || "",

      bagWeightKg: toNumber(req.body.bagWeightKg),

      expenses,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.send(
      new PutCommand({
        TableName: ACTIVITIES_TABLE,
        Item: activity,
      })
    );

    res.status(201).json(enrichActivity(activity));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "작업 기록 저장에 실패했습니다.",
    });
  }
});

app.delete("/api/activities/:id", async (req, res) => {
  try {
    const found = await db.send(
      new GetCommand({
        TableName: ACTIVITIES_TABLE,
        Key: {
          id: req.params.id,
        },
      })
    );

    if (!found.Item) {
      return res.status(404).json({
        message: "작업 기록을 찾을 수 없습니다.",
      });
    }

    await db.send(
      new DeleteCommand({
        TableName: ACTIVITIES_TABLE,
        Key: {
          id: req.params.id,
        },
      })
    );

    res.status(204).send();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "작업 기록 삭제에 실패했습니다.",
    });
  }
});

app.get("/api/sales", async (req, res) => {
  try {
    const { year, buyerType, farmId } = req.query;

    let sales = await scanAll(SALES_TABLE);

    if (year) {
      sales = sales.filter((sale) => String(sale.year) === String(year));
    }

    if (buyerType) {
      sales = sales.filter((sale) => sale.buyerType === buyerType);
    }

    if (farmId) {
      sales = sales.filter((sale) => sale.farmId === farmId);
    }

    sales.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    res.json(sales.map(enrichSale));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "판매 기록을 불러오지 못했습니다.",
    });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    const date = req.body.date;

    if (!date) {
      return res.status(400).json({
        message: "판매 날짜는 필수입니다.",
      });
    }

    const year = Number(date.slice(0, 4));
    const saleMethod = req.body.saleMethod || "SAME_DAY";

    const sale = {
      id: uuidv4(),
      year,
      date,
      farmId: req.body.farmId,

      buyerType: req.body.buyerType || "기타",
      buyerName: req.body.buyerName || "",

      saleMethod,

      bagType:
        req.body.bagType ||
        (saleMethod === "AFTER_SORTING"
          ? "SORTED_SALE_BAG"
          : "FIELD_BAG"),

      quantityBag: toNumber(req.body.quantityBag),

      bagWeightKg:
        saleMethod === "AFTER_SORTING"
          ? toNumber(req.body.bagWeightKg)
          : 0,

      pricePerBag: toNumber(req.body.pricePerBag),
      qualityMemo: req.body.qualityMemo || "",
      memo: req.body.memo || "",

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.send(
      new PutCommand({
        TableName: SALES_TABLE,
        Item: sale,
      })
    );

    res.status(201).json(enrichSale(sale));
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "판매 기록 저장에 실패했습니다.",
    });
  }
});

app.get("/api/summary", async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());

    const [allActivities, allSales] = await Promise.all([
      scanAll(ACTIVITIES_TABLE),
      scanAll(SALES_TABLE),
    ]);

    const yearActivities = allActivities
      .filter((activity) => activity.year === year)
      .map(enrichActivity);

    const yearSales = allSales
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

      // 현장 가마 / 선별 후 판매용 가마가 섞이므로 참고용
      stockBags: totalHarvestBags - totalSoldBags,

      averagePricePerBag: totalSoldBags
        ? Math.round(totalRevenue / totalSoldBags)
        : 0,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "요약 정보를 불러오지 못했습니다.",
    });
  }
});

async function startServer() {
  try {
    await ensureDefaultFarms();

    app.listen(PORT, () => {
      console.log(`Bam Farm backend running on http://localhost:${PORT}`);
      console.log(`DynamoDB tables: ${FARMS_TABLE}, ${ACTIVITIES_TABLE}, ${SALES_TABLE}`);
    });
  } catch (error) {
    console.error("서버 시작 실패:", error);
    process.exit(1);
  }
}

startServer();