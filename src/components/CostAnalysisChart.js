"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Chart, registerables } from "chart.js";

// Constants
const INITIAL_DRIVING_HOURS = [23, 48, 43, 29, 50, 108];
const BASE_COST_PER_HOUR = 100;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Utility Functions
function calculateMonthlyCost(hours, costPerHour = BASE_COST_PER_HOUR) {
  return Math.max(0, hours * costPerHour);
}

function validateHours(hours) {
  if (!Array.isArray(hours) || hours.length === 0) {
    throw new Error("Invalid driving hours data");
  }
  return hours.every((hour) => typeof hour === "number" && hour >= 0);
}

function predictFutureHours(historicalHours) {
  if (!validateHours(historicalHours)) {
    throw new Error("Invalid hours data");
  }

  // Advanced prediction with weighted recent months
  const weightedAverage =
    historicalHours.slice(-3).reduce((sum, hour, index) => {
      const weight = index + 1;
      return sum + hour * weight;
    }, 0) /
    historicalHours.slice(-3).reduce((sum, _, index) => sum + (index + 1), 0);

  return Math.round(weightedAverage);
}

// Spell Options with more detailed cost breakdown
const SPELL_OPTIONS = {
  NONE: {
    label: "No Spell",
    tireCost: 0,
    engineCost: 0,
    hourlyRate: BASE_COST_PER_HOUR,
    description: "Continue journey with original car efficiency",
    efficiency: 1,
    risk: 0,
  },
  TIRE: {
    label: "Tire Spell",
    tireCost: 10,
    engineCost: 0,
    hourlyRate: 93,
    description: "Upgrade tires for slightly improved efficiency",
    efficiency: 1.07,
    risk: 0.1,
  },
  ENGINE: {
    label: "Engine Spell",
    tireCost: 0,
    engineCost: 32,
    hourlyRate: 83,
    description: "Upgrade engine for significant efficiency improvement",
    efficiency: 1.17,
    risk: 0.2,
  },
  BOTH: {
    label: "Both Spells",
    tireCost: 10,
    engineCost: 32,
    hourlyRate: 83,
    description: "Comprehensive magical upgrade for maximum efficiency",
    efficiency: 1.25,
    risk: 0.3,
  },
};

Chart.register(...registerables);

export default function CostAnalysisChart() {
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [selectedSpells, setSelectedSpells] = useState([]);
  const [error, setError] = useState(null);

  const predictedHours = useMemo(() => {
    try {
      return predictFutureHours(INITIAL_DRIVING_HOURS);
    } catch (err) {
      setError("Unable to predict driving hours");
      return 0;
    }
  }, []);

  const generateSpellData = useCallback(
    (spell, spellStartMonth) => {
      return MONTHS.map((_, index) => {
        // Historical data (Jan-June)
        if (index < 6) {
          return calculateMonthlyCost(INITIAL_DRIVING_HOURS[index]);
        }

        // Before spell application
        if (index < spellStartMonth) {
          return calculateMonthlyCost(predictedHours);
        }

        // After spell application
        const spellTotalCost = spell.tireCost + spell.engineCost;
        const monthlyCost = calculateMonthlyCost(
          predictedHours,
          spell.hourlyRate
        );

        return index === spellStartMonth
          ? spellTotalCost + monthlyCost
          : monthlyCost;
      });
    },
    [predictedHours]
  );

  const addSpell = useCallback(() => {
    setSelectedSpells((prev) => [
      ...prev,
      {
        spell: SPELL_OPTIONS.NONE,
        month: 6,
        id: Date.now(), // unique identifier
      },
    ]);
  }, []);

  const removeSpell = useCallback((spellId) => {
    setSelectedSpells((prev) => prev.filter((spell) => spell.id !== spellId));
  }, []);

  const updateSpell = useCallback((id, newSpell, newMonth) => {
    setSelectedSpells((prev) =>
      prev.map((spell) =>
        spell.id === id ? { ...spell, spell: newSpell, month: newMonth } : spell
      )
    );
  }, []);

  // Add a function to generate baseline data (without spells)
  const generateBaselineData = useMemo(() => {
    try {
      return MONTHS.map((_, index) => {
        // For January to June, use actual historical hours
        if (index < 6) {
          return calculateMonthlyCost(INITIAL_DRIVING_HOURS[index]);
        }
        // For July onwards, use base predictions without spells
        return calculateMonthlyCost(predictedHours);
      });
    } catch (err) {
      setError("Error calculating baseline costs");
      return new Array(12).fill(0);
    }
  }, [predictedHours]);

  // Add this function to calculate total savings for a spell scenario
  const calculateScenarioSavings = useCallback(
    (spellConfig) => {
      const baselineCost = generateBaselineData.reduce(
        (sum, cost) => sum + cost,
        0
      );
      const spellCost = generateSpellData(
        spellConfig.spell,
        spellConfig.month
      ).reduce((sum, cost) => sum + cost, 0);

      return {
        savings: baselineCost - spellCost,
        spellConfig,
        roi:
          ((baselineCost - spellCost) /
            (spellConfig.spell.tireCost + spellConfig.spell.engineCost)) *
          100,
      };
    },
    [generateBaselineData, generateSpellData]
  );

  // Add this function to find the recommended scenario
  const getRecommendedScenario = useMemo(() => {
    if (selectedSpells.length === 0) return null;

    const scenarioAnalysis = selectedSpells.map((spellConfig) => {
      const analysis = calculateScenarioSavings(spellConfig);
      return {
        ...analysis,
        description: `${spellConfig.spell.label} in ${
          MONTHS[spellConfig.month]
        }`,
      };
    });

    // Sort by savings and get the best scenario
    const bestScenario = scenarioAnalysis.reduce(
      (best, current) => (current.savings > best.savings ? current : best),
      scenarioAnalysis[0]
    );

    return {
      ...bestScenario,
      recommendation:
        bestScenario.savings > 0
          ? `Recommended: ${
              bestScenario.description
            } provides the highest savings of ${bestScenario.savings.toFixed(
              2
            )} gold coins with an ROI of ${bestScenario.roi.toFixed(1)}%`
          : "None of the current scenarios provide cost savings.",
    };
  }, [selectedSpells, calculateScenarioSavings]);

  useEffect(() => {
    if (chartRef.current) {
      try {
        const ctx = chartRef.current.getContext("2d");

        if (chartInstance) {
          chartInstance.destroy();
        }

        // Define chart colors
        const colors = [
          {
            border: "rgb(75, 192, 192)",
            background: "rgba(75, 192, 192, 0.2)",
          },
          {
            border: "rgb(255, 99, 132)",
            background: "rgba(255, 99, 132, 0.2)",
          },
          {
            border: "rgb(255, 159, 64)",
            background: "rgba(255, 159, 64, 0.2)",
          },
          {
            border: "rgb(153, 102, 255)",
            background: "rgba(153, 102, 255, 0.2)",
          },
          {
            border: "rgb(54, 162, 235)",
            background: "rgba(54, 162, 235, 0.2)",
          },
        ];

        const datasets = [
          // Baseline dataset
          {
            label: "Without Spells",
            data: generateBaselineData,
            borderColor: colors[0].border,
            backgroundColor: colors[0].background,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: colors[0].border,
          },
          // Datasets for each selected spell
          ...selectedSpells.map((spellConfig, index) => ({
            label: `With ${spellConfig.spell.label} (${
              MONTHS[spellConfig.month]
            })`,
            data: generateSpellData(spellConfig.spell, spellConfig.month),
            borderColor: colors[(index + 1) % colors.length].border,
            backgroundColor: colors[(index + 1) % colors.length].background,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: colors[(index + 1) % colors.length].border,
          })),
        ];

        const newChartInstance = new Chart(ctx, {
          type: "line",
          data: { labels: MONTHS, datasets },
          options: {
            responsive: true,
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const datasetLabel = context.dataset.label;
                    const value = context.parsed.y;
                    return `${datasetLabel}: ${value} Gold Coins`;
                  },
                },
              },
              legend: {
                display: true,
                position: "top",
                labels: {
                  usePointStyle: true,
                  padding: 20,
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: "Gold Coins Spent",
                },
              },
              x: {
                title: {
                  display: true,
                  text: "Month",
                },
              },
            },
            interaction: {
              intersect: false,
              mode: "index",
            },
          },
        });

        setChartInstance(newChartInstance);
        setError(null);
      } catch (err) {
        setError("Failed to render chart");
      }
    }
  }, [selectedSpells, generateBaselineData, generateSpellData]);

  // Calculate total journey cost
  const totalJourneyCost = useMemo(() => {
    return selectedSpells.reduce((sum, spellConfig) => {
      return (
        sum +
        generateSpellData(spellConfig.spell, spellConfig.month).reduce(
          (sum, cost) => sum + cost,
          0
        )
      );
    }, 0);
  }, [selectedSpells, generateSpellData]);

  const getRiskAssessment = useCallback(() => {
    const riskLevel = selectedSpells.reduce((maxRisk, spellConfig) => {
      return Math.max(maxRisk, spellConfig.spell.risk);
    }, 0);
    if (riskLevel === 0) return "No Additional Risk";
    if (riskLevel <= 0.1) return "Low Risk";
    if (riskLevel <= 0.2) return "Medium Risk";
    return "High Risk";
  }, [selectedSpells]);

  // Add a comparison section in the UI
  const costDifference = useMemo(() => {
    const baselineTotal = generateBaselineData.reduce(
      (sum, cost) => sum + cost,
      0
    );
    const spellTotal = totalJourneyCost;
    return baselineTotal - spellTotal;
  }, [generateBaselineData, totalJourneyCost]);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">
        Dorothy&apos;s Magical Journey Cost Analysis
      </h1>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={addSpell}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add New Spell Scenario
        </button>
      </div>

      {selectedSpells.map((spellConfig) => (
        <div
          key={spellConfig.id}
          className="grid md:grid-cols-2 gap-4 mb-6 p-4 border rounded"
        >
          <div>
            <label className="block mb-2 font-semibold">
              Select Magical Spell:
            </label>
            <select
              value={Object.keys(SPELL_OPTIONS).find(
                (key) => SPELL_OPTIONS[key] === spellConfig.spell
              )}
              onChange={(e) =>
                updateSpell(
                  spellConfig.id,
                  SPELL_OPTIONS[e.target.value],
                  spellConfig.month
                )
              }
              className="w-full p-2 border rounded"
            >
              {Object.keys(SPELL_OPTIONS).map((key) => (
                <option key={key} value={key}>
                  {SPELL_OPTIONS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-semibold">
              Select Spell Month:
            </label>
            <select
              value={spellConfig.month}
              onChange={(e) =>
                updateSpell(
                  spellConfig.id,
                  spellConfig.spell,
                  Number(e.target.value)
                )
              }
              className="w-full p-2 border rounded"
            >
              {MONTHS.slice(6).map((month, index) => (
                <option key={month} value={index + 6}>
                  {month}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeSpell(spellConfig.id)}
              className="mt-2 text-red-500 hover:text-red-700"
            >
              Remove Spell
            </button>
          </div>
        </div>
      ))}

      {selectedSpells.length > 0 && getRecommendedScenario && (
        <div
          className={`mb-6 p-4 rounded ${
            getRecommendedScenario.savings > 0 ? "bg-green-50" : "bg-yellow-50"
          }`}
        >
          <h2 className="font-bold text-lg mb-2">Recommendation Analysis</h2>
          <p
            className={`${
              getRecommendedScenario.savings > 0
                ? "text-green-700"
                : "text-yellow-700"
            }`}
          >
            {getRecommendedScenario.recommendation}
          </p>
          {getRecommendedScenario.savings > 0 && (
            <div className="mt-2 text-sm">
              <p>
                Investment Required:{" "}
                {(
                  getRecommendedScenario.spellConfig.spell.tireCost +
                  getRecommendedScenario.spellConfig.spell.engineCost
                ).toFixed(2)}{" "}
                gold coins
              </p>
              <p>
                Return on Investment: {getRecommendedScenario.roi.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded shadow-lg mb-4">
        <canvas ref={chartRef}></canvas>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded">
          <h2 className="font-bold mb-2">Journey Cost Summary</h2>
          <p>
            Cost Without Spells:{" "}
            {generateBaselineData
              .reduce((sum, cost) => sum + cost, 0)
              .toFixed(2)}{" "}
            Gold Coins
          </p>
          <p>
            Cost With Selected Spells: {totalJourneyCost.toFixed(2)} Gold Coins
          </p>
          <p
            className={`font-bold ${
              costDifference > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            Total Savings: {costDifference.toFixed(2)} Gold Coins
          </p>
          <p>Risk Assessment: {getRiskAssessment()}</p>
        </div>
      </div>
    </div>
  );
}
