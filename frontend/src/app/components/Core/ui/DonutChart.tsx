import React from "react";
import Chart from "react-apexcharts";

interface DonutChartProps {
  title: string;
  labels: string[];
  series: number[];
  colors?: string[]; // Optional custom colors
}

export default function DonutChart({
  title,
  labels,
  series,
  colors,
}: DonutChartProps) {
  const chartColors = colors || [
    "#ea580c",
    "#2563eb",
    "#16a34a",
    "#db2777",
    "#9333ea",
    "#0891b2",
  ];

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "donut",
      animations: {
        enabled: true,
        speed: 900,
      },
    },
    labels,
    legend: {
      position: "bottom",
      fontSize: "14px",
    },
    colors: chartColors,
    dataLabels: {
      enabled: false, // Cleaner look for Enterprise
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%", // Thicker donut for better visibility
          labels: {
            show: true,
            name: {
              offsetY: -10,
              color: "#6b7280",
              fontSize: "14px",
            },
            value: {
              offsetY: 5,
              fontSize: "24px",
              fontWeight: 700,
              color: "#1f2937",
              formatter: (val) => val.toString(), // Show generic number
            },
            total: {
              show: true,
              label: "Total",
              fontSize: "14px",
              fontWeight: 600,
              color: "#6b7280",
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: any, b: any) => {
                  return a + b;
                }, 0);
              },
            },
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-full min-h-[350px] flex flex-col">
      {title && (
        <h2 className="text-lg font-semibold text-k-dark-grey mb-4">{title}</h2>
      )}
      <div className="flex-1 w-full flex items-center justify-center px-2 pb-10">
        <Chart
          options={options}
          series={series}
          type="donut"
          height="100%"
          width="100%"
        />
      </div>
    </div>
  );
}
