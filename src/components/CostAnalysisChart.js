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
  },
  TIRE: {
    label: "Tire Spell",
    tireCost: 10,
    engineCost: 0,
    hourlyRate: 93,
    description: "Upgrade tires for slightly improved efficiency",
    efficiency: 1.07,
  },
  ENGINE: {
    label: "Engine Spell",
    tireCost: 0,
    engineCost: 32,
    hourlyRate: 83,
    description: "Upgrade engine for significant efficiency improvement",
    efficiency: 1.17,
  },
  BOTH: {
    label: "Both Spells",
    tireCost: 10,
    engineCost: 32,
    hourlyRate: 83,
    description: "Comprehensive magical upgrade for maximum efficiency",
    efficiency: 1.25,
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
          ? `${
              bestScenario.description
            } provides the highest savings of ${bestScenario.savings.toFixed(
              2
            )} gold coins with an ROI of ${bestScenario.roi.toFixed(1)}%`
          : "None of the current scenarios provide cost savings.",
    };
  }, [selectedSpells, calculateScenarioSavings]);

  useEffect(() => {
    if (!chartRef.current) return;

    try {
      const ctx = chartRef.current.getContext("2d");

      // Destroy existing chart instance if it exists
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
                color: "#e2e8f0",
                usePointStyle: true,
                padding: 20,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: "rgba(148, 163, 184, 0.1)",
              },
              ticks: {
                color: "#e2e8f0",
              },
              title: {
                display: true,
                text: "Gold Coins Spent",
                color: "#e2e8f0",
              },
            },
            x: {
              grid: {
                color: "rgba(148, 163, 184, 0.1)",
              },
              ticks: {
                color: "#e2e8f0",
              },
              title: {
                display: true,
                text: "Month",
                color: "#e2e8f0",
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

    // Cleanup function
    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Update the costDifference calculation
  const costDifference = useMemo(() => {
    const baselineTotal = generateBaselineData.reduce(
      (sum, cost) => sum + cost,
      0
    );

    // If there's no recommended scenario, return 0
    if (!getRecommendedScenario) return 0;

    // Calculate cost with recommended spell
    const recommendedSpellCost = generateSpellData(
      getRecommendedScenario.spellConfig.spell,
      getRecommendedScenario.spellConfig.month
    ).reduce((sum, cost) => sum + cost, 0);

    return baselineTotal - recommendedSpellCost;
  }, [generateBaselineData, generateSpellData, getRecommendedScenario]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Full Width Header */}
      <header className="w-full bg-gray-800/50 border-b border-purple-500/30 p-6 text-center">
        <h1
          className={`text-3xl lg:text-5xl mb-2 lg:mb-4 font-wizard bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-transparent bg-clip-text`}
        >
          Dorothy & The Witch
        </h1>
        <p className="text-lg lg:text-xl text-purple-300 italic">
          A Magical Journey Cost Analysis
        </p>
      </header>

      {/* Content Container */}
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Sidebar */}
        <div className="w-full lg:w-80 bg-gray-800/50 border-b lg:border-r border-purple-500/30 p-4 lg:p-6 flex flex-col">
          {/* Sidebar Header */}
          <div className="mb-6 lg:mb-8">
            <h2 className="text-xl font-wizard text-purple-300 mb-2">
              Spell Workshop
            </h2>
            <p className="text-sm text-gray-400">
              Create and manage your magical scenarios
            </p>
          </div>

          {/* Rest of the sidebar content */}
          <button
            onClick={addSpell}
            className="bg-purple-600 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-lg hover:bg-purple-700 
                       transition-all duration-200 shadow-lg hover:shadow-purple-500/25
                       font-semibold tracking-wide mb-4 lg:mb-6 text-sm lg:text-base"
          >
            ✨ Add New Spell Scenario
          </button>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] lg:max-h-none">
            {/* Spell configurations */}
            {selectedSpells.map((spellConfig) => (
              <div
                key={spellConfig.id}
                className="p-3 lg:p-4 rounded-lg border border-purple-500/30 
                              bg-gray-800 backdrop-blur-sm shadow-xl"
              >
                <div className="space-y-3 lg:space-y-4">
                  <div>
                    <label className="block mb-1 lg:mb-2 font-semibold text-purple-300 text-sm lg:text-base">
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
                      className="w-full p-2 rounded bg-gray-700 border border-purple-500/30 
                                 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent
                                 text-sm lg:text-base"
                    >
                      {Object.keys(SPELL_OPTIONS).map((key) => (
                        <option key={key} value={key}>
                          {SPELL_OPTIONS[key].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 lg:mb-2 font-semibold text-purple-300 text-sm lg:text-base">
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
                      className="w-full p-2 rounded bg-gray-700 border border-purple-500/30 
                                 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent
                                 text-sm lg:text-base"
                    >
                      {MONTHS.slice(6).map((month, index) => (
                        <option key={month} value={index + 6}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => removeSpell(spellConfig.id)}
                    className="w-full mt-2 px-3 py-1 text-red-400 hover:text-red-300 
                               transition-colors duration-200 border border-red-400/50 
                               rounded hover:bg-red-400/10 text-sm lg:text-base"
                  >
                    🗑️ Remove Spell
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded relative mb-4 text-sm lg:text-base">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Chart Container */}
          <div className="bg-gray-800/50 p-4 lg:p-6 rounded-lg shadow-xl border border-purple-500/30 backdrop-blur-sm mb-4 lg:mb-6">
            <canvas ref={chartRef}></canvas>
          </div>

          {/* Bottom Section Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Description Section - Add this first */}
            <div className="lg:col-span-2 bg-gray-800/50 p-4 lg:p-6 rounded-lg border border-purple-500/30 backdrop-blur-sm mb-4">
              <h2 className="font-bold text-lg lg:text-xl mb-3 text-purple-300">
                🌟 Welcome to Dorothy's Magical Journey Planner!
              </h2>
              <p className="text-sm lg:text-base text-gray-300 leading-relaxed">
                Embark on an enchanted adventure through Munchkin Land with
                Dorothy&apos;s interactive cost calculator! The Wicked Witch of
                the West has offered magical upgrades for Dorothy&apos;s car -
                but are they worth the investment? Explore different spell
                combinations, compare costs, and discover the most economical
                path to Oz. Simply add spell scenarios, choose your timing, and
                watch as the magic unfolds in real-time through our dynamic
                visualization. Let&apos;s find the perfect balance between magic
                and gold coins! ✨🚗
              </p>
            </div>

            {/* Journey Cost Summary */}
            <div className="bg-gray-800/50 p-4 lg:p-6 rounded-lg border border-purple-500/30 backdrop-blur-sm">
              <h2 className="font-bold text-lg lg:text-xl mb-3 lg:mb-4 text-purple-300">
                Journey Cost Summary
              </h2>
              <div className="space-y-2 text-sm lg:text-base text-gray-300">
                <p>
                  Cost Without Spells:{" "}
                  {generateBaselineData
                    .reduce((sum, cost) => sum + cost, 0)
                    .toFixed(2)}{" "}
                  Gold Coins
                </p>
                {getRecommendedScenario && (
                  <p>
                    Cost With Recommended Spell:{" "}
                    {generateSpellData(
                      getRecommendedScenario.spellConfig.spell,
                      getRecommendedScenario.spellConfig.month
                    )
                      .reduce((sum, cost) => sum + cost, 0)
                      .toFixed(2)}{" "}
                    Gold Coins
                  </p>
                )}
                <p
                  className={`font-bold ${
                    costDifference > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  Total Savings: {costDifference.toFixed(2)} Gold Coins
                </p>
              </div>
            </div>

            {/* Recommendation Section */}
            {selectedSpells.length > 0 && getRecommendedScenario && (
              <div
                className={`p-4 rounded ${
                  getRecommendedScenario.savings > 0
                    ? "bg-green-900/50 border border-green-500"
                    : "bg-yellow-900/50 border border-yellow-500"
                }`}
              >
                <h2 className="font-bold text-base lg:text-lg mb-2">
                  Recommended Spell:{" "}
                  {getRecommendedScenario.spellConfig.spell.label}
                </h2>
                <p
                  className={`text-sm lg:text-base ${
                    getRecommendedScenario.savings > 0
                      ? "text-green-300"
                      : "text-yellow-300"
                  }`}
                >
                  {getRecommendedScenario.recommendation}
                </p>
                {getRecommendedScenario.savings > 0 && (
                  <div className="mt-2 text-xs lg:text-sm text-gray-300">
                    <p>
                      Investment Required:{" "}
                      {(
                        getRecommendedScenario.spellConfig.spell.tireCost +
                        getRecommendedScenario.spellConfig.spell.engineCost
                      ).toFixed(2)}{" "}
                      gold coins
                    </p>
                    <p>
                      Return on Investment:{" "}
                      {getRecommendedScenario.roi.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
