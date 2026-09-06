"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { API_URL } from "../lib/api";
import Sidebar from "../components/Sidebar";
import TradeForm from "../components/TradeForm";
import TradesTable from "../components/TradesTable";
import StatisticsCards, { type DashboardStatistics } from "../components/StatisticsCards";
import PerformanceChart, { type DashboardPerformance } from "../components/PerformanceChart";
import DateRangeFilter, { type DateRangePreset } from "../components/DateRangeFilter";
import TradingCalendar, { type TradingCalendarDay } from "../components/TradingCalendar";

type Trade = [number, string, string, number, number | null, number, number | null, number, string, string];

type Account = {
  id: number;
  user_id: string;
  name: string;
  starting_balance: number;
  currency: string;
  broker: string | null;
  account_type: string | null;
  created_at?: string;
};

type PaginatedTradesResponse = {
  items: Trade[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type DashboardData = DashboardStatistics & {
  performance: DashboardPerformance;
};

type CalendarData = {
  total_trades: number;
  trading_days: number;
  total_pnl: number;
  total_r: number | null;
  trades_with_r: number;
  days: TradingCalendarDay[];
};

const EMPTY_DASHBOARD_DATA: DashboardData = {
  total_trades: 0,
  winning_trades: 0,
  total_pnl: 0,
  total_r: null,
  trades_with_r: 0,
  win_rate: 0,
  average_r: null,
  performance: { r: [], pnl: [] },
};

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [exit, setExit] = useState("");
  const [pnl, setPnl] = useState("");
  const [entryDatetime, setEntryDatetime] = useState("");
  const [exitDatetime, setExitDatetime] = useState("");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeFormError, setTradeFormError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [editingTradeId, setEditingTradeId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarDays, setCalendarDays] = useState<TradingCalendarDay[]>([]);
  const [calendarPeriod, setCalendarPeriod] = useState(() => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  });

  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  ) ?? null;

  const loadCalendarData = useCallback(async (
    accessToken: string,
    accountId: number,
    year: number,
    month: number,
  ) => {
    const params = new URLSearchParams({
      account_id: String(accountId),
      year: String(year),
      month: String(month),
    });

    const response = await fetch(`${API_URL}/calendar?${params}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      setCalendarDays([]);
      return;
    }

    const data: CalendarData = await response.json();
    setCalendarDays(data.days);
  }, []);

  const loadDashboardData = useCallback(async (accessToken: string, accountId: number) => {
    const incompleteCustomRange =
      datePreset === "custom" && (!dateFrom || !dateTo);
    const invalidCustomRange =
      datePreset === "custom" && dateFrom > dateTo;

    if (incompleteCustomRange || invalidCustomRange) return;

    const requestOptions = {
      cache: "no-store" as RequestCache,
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const tradesParams = new URLSearchParams({
      account_id: String(accountId),
      page: "1",
      page_size: "5",
    });
    const statisticsParams = new URLSearchParams({
      account_id: String(accountId),
    });

    if (dateFrom) {
      tradesParams.set("date_from", dateFrom);
      statisticsParams.set("date_from", dateFrom);
    }

    if (dateTo) {
      tradesParams.set("date_to", dateTo);
      statisticsParams.set("date_to", dateTo);
    }

    const [tradesResponse, statisticsResponse] = await Promise.all([
      fetch(`${API_URL}/trades?${tradesParams}`, requestOptions),
      fetch(`${API_URL}/statistics?${statisticsParams}`, requestOptions),
    ]);

    if (!tradesResponse.ok || !statisticsResponse.ok) return;

    const tradesData: PaginatedTradesResponse = await tradesResponse.json();
    const statisticsData: DashboardData = await statisticsResponse.json();
    setTrades(tradesData.items);
    setDashboardData(statisticsData);
  }, [datePreset, dateFrom, dateTo]);

  function handleDatePresetChange(preset: DateRangePreset) {
    setDatePreset(preset);

    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    if (preset === "custom") return;

    const today = new Date();
    const firstDay = new Date(today);

    firstDay.setDate(
      today.getDate() - (preset === "30d" ? 29 : 89),
    );

    setDateFrom(formatDate(firstDay));
    setDateTo(formatDate(today));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    router.push("/login");
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUserEmail(session.user.email ?? null);
      setSession(session);
      setAuthLoading(false);
    }

    loadUser();

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.push("/login");
          return;
        }

        setSession(session);
        setUserEmail(session.user.email ?? null);
      },
    );

    return () => data.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!session) return;

    const accessToken = session.access_token;

    async function loadAccounts() {
      setDashboardLoading(true);

      const response = await fetch(`${API_URL}/accounts`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setDashboardLoading(false);
        return;
      }

      const data: Account[] = await response.json();

      setAccounts(data);

      if (data.length > 0) {
        setSelectedAccountId((current) =>
          current !== null
            && data.some((account) => account.id === current)
            ? current
            : data[0].id,
        );
      } else {
        setSelectedAccountId(null);
        setTrades([]);
        setDashboardData(EMPTY_DASHBOARD_DATA);
        setCalendarDays([]);
        setDashboardLoading(false);
      }
    }

    loadAccounts();
  }, [session]);

  useEffect(() => {
    if (!session || selectedAccountId === null) return;

    async function fetchDashboardData() {
      setDashboardLoading(true);

      await loadDashboardData(
        session!.access_token,
        selectedAccountId!,
      );

      setDashboardLoading(false);
    }

    fetchDashboardData();
  }, [session, selectedAccountId, loadDashboardData]);

  useEffect(() => {
    if (!session || selectedAccountId === null) return;

    async function fetchCalendarData() {
      await loadCalendarData(
        session!.access_token,
        selectedAccountId!,
        calendarPeriod.year,
        calendarPeriod.month,
      );
    }

    fetchCalendarData();
  }, [
    session,
    selectedAccountId,
    calendarPeriod.year,
    calendarPeriod.month,
    loadCalendarData,
  ]);

  async function handleSaveTrade() {
    if (
      !symbol
      || !direction
      || !entry
      || !exit
      || !pnl
      || !entryDatetime
      || !exitDatetime
    ) {
      setTradeFormError("Please fill in all required fields.");
      return;
    }

    setTradeFormError(null);

    if (new Date(exitDatetime) < new Date(entryDatetime)) {
      setTradeError("Exit date cannot be before entry date.");
      return;
    }

    const accountId = selectedAccountId!;

    const tradeData = {
      account_id: accountId,
      symbol,
      direction,
      entry: Number(entry),
      stop: stop === "" ? null : Number(stop),
      exit: Number(exit),
      pnl: Number(pnl),
      entry_datetime: entryDatetime,
      exit_datetime: exitDatetime,
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const response = await fetch(`${API_URL}/trades`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(tradeData),
    });

    if (response.ok) {
      await Promise.all([
        loadDashboardData(session.access_token, accountId),
        loadCalendarData(
          session.access_token,
          accountId,
          calendarPeriod.year,
          calendarPeriod.month,
        ),
      ]);

      setSymbol("");
      setDirection("");
      setEntry("");
      setStop("");
      setExit("");
      setPnl("");
      setEntryDatetime("");
      setExitDatetime("");
      setShowForm(false);
    }
  }

  async function handleDeleteTrade(tradeId: number) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const response = await fetch(`${API_URL}/trades/${tradeId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.ok && selectedAccountId !== null) {
      await Promise.all([
        loadDashboardData(session.access_token, selectedAccountId),
        loadCalendarData(
          session.access_token,
          selectedAccountId,
          calendarPeriod.year,
          calendarPeriod.month,
        ),
      ]);
    }
  }

  function handleEditTrade(trade: Trade) {
    setShowForm(false);
    setEditingTradeId(trade[0]);
    setSymbol(trade[1]);
    setDirection(trade[2]);
    setEntry(String(trade[3]));
    setStop(trade[4] === null ? "" : String(trade[4]));
    setExit(String(trade[5]));
    setPnl(String(trade[7]));
    setEntryDatetime(trade[8].slice(0, 16));
    setExitDatetime(trade[9].slice(0, 16));
  }

  async function handleUpdateTrade(tradeId: number) {
    if (!entryDatetime || !exitDatetime) return;

    const tradeData = {
      symbol,
      direction,
      entry: Number(entry),
      stop: stop === "" ? null : Number(stop),
      exit: Number(exit),
      pnl: Number(pnl),
      entry_datetime: entryDatetime,
      exit_datetime: exitDatetime,
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const response = await fetch(`${API_URL}/trades/${tradeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(tradeData),
    });

    if (response.ok) {
      await Promise.all([
        loadDashboardData(session.access_token, selectedAccountId!),
        loadCalendarData(
          session.access_token,
          selectedAccountId!,
          calendarPeriod.year,
          calendarPeriod.month,
        ),
      ]);

      setEditingTradeId(null);
    }
  }

  if (authLoading) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <main className="min-w-0 flex-1 px-5 py-5 sm:px-6 md:px-8 md:py-8 xl:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="pl-14 md:pl-0">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Overview of your trading performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedAccountId !== null && (
              <select
                value={selectedAccountId}
                onChange={(event) =>
                  setSelectedAccountId(Number(event.target.value))
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900"
              >
                {accounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingTradeId(null);
                setSymbol("");
                setDirection("");
                setEntry("");
                setStop("");
                setExit("");
                setPnl("");
                setEntryDatetime("");
                setExitDatetime("");
                setTradeFormError(null);
                setShowForm(!showForm);
              }}
              disabled={selectedAccountId === null}
              className="cursor-pointer rounded-lg bg-black px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add Trade
            </button>
          </div>
        </div>

        <DateRangeFilter
          preset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPresetChange={handleDatePresetChange}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        {!dashboardLoading && accounts.length === 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Create a trading account before adding trades.
          </div>
        )}

        {showForm && selectedAccountId !== null && (
          <>
            <TradeForm
              symbol={symbol}
              direction={direction}
              entry={entry}
              stop={stop}
              exit={exit}
              pnl={pnl}
              entryDatetime={entryDatetime}
              exitDatetime={exitDatetime}
              setSymbol={setSymbol}
              setDirection={setDirection}
              setEntry={setEntry}
              setStop={setStop}
              setExit={setExit}
              setPnl={setPnl}
              setEntryDatetime={setEntryDatetime}
              setExitDatetime={setExitDatetime}
              onSave={handleSaveTrade}
            />

            {tradeFormError && (
              <p className="mt-2 text-sm text-red-600">
                {tradeFormError}
              </p>
            )}
          </>
        )}

        {dashboardLoading ? (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl bg-slate-200"
                />
              ))}
            </div>

            <div className="mt-8 h-40 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-8 h-64 animate-pulse rounded-2xl bg-slate-200" />
          </>
        ) : (
          <>
            <StatisticsCards
              statistics={dashboardData}
              startingBalance={selectedAccount?.starting_balance ?? 0}
              currency={selectedAccount?.currency ?? ""}
            />

            <div className="mt-8">
              <TradingCalendar
                year={calendarPeriod.year}
                month={calendarPeriod.month}
                currency={selectedAccount?.currency ?? ""}
                days={calendarDays}
                onMonthChange={(year, month) =>
                  setCalendarPeriod({ year, month })
                }
              />
            </div>

            <PerformanceChart
              performance={dashboardData.performance}
              totalTrades={dashboardData.total_trades}
              tradesWithR={dashboardData.trades_with_r}
              currency={selectedAccount?.currency ?? ""}
            />

            <TradesTable
              trades={trades}
              showViewAll
              selectedAccountId={selectedAccountId}
              editingTradeId={editingTradeId}
              symbol={symbol}
              direction={direction}
              entry={entry}
              stop={stop}
              exit={exit}
              pnl={pnl}
              entryDatetime={entryDatetime}
              exitDatetime={exitDatetime}
              setSymbol={setSymbol}
              setDirection={setDirection}
              setEntry={setEntry}
              setStop={setStop}
              setExit={setExit}
              setPnl={setPnl}
              setEntryDatetime={setEntryDatetime}
              setExitDatetime={setExitDatetime}
              onEdit={handleEditTrade}
              onUpdate={handleUpdateTrade}
              onDelete={handleDeleteTrade}
            />
          </>
        )}
      </main>

      {tradeError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-rose-600">
              Invalid trade
            </h3>

            <p className="mt-3 text-sm leading-6 text-zinc-700">
              {tradeError}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setTradeError(null)}
                className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}