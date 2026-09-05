import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Home from "./page";

type Trade = [number, string, string, number, number | null, number, number | null, number, string, string];
type Account = {
    id: number;
    user_id: string;
    name: string;
    starting_balance: number;
    currency: string;
    broker: string | null;
    account_type: string | null;
};
type Statistics = {
    total_trades: number;
    winning_trades: number;
    total_pnl: number;
    total_r: number | null;
    trades_with_r: number;
    win_rate: number;
    average_r: number | null;
    performance: {
        r: Array<{ trade_number: number; value: number }>;
        pnl: Array<{ trade_number: number; value: number }>;
    };
};

const {
    mockGetSession,
    mockSignOut,
    mockOnAuthStateChange,
    mockUnsubscribe,
    mockPush,
    authCallback,
    formActions,
    tableActions,
} = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockSignOut: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockUnsubscribe: vi.fn(),
    mockPush: vi.fn(),
    authCallback: { current: null as ((event: string, session: unknown) => void) | null },
    formActions: {
        fillValidTrade: null as (() => void) | null,
        clearDates: null as (() => void) | null,
        clearStop: null as (() => void) | null,
        reverseDates: null as (() => void) | null,
        save: null as (() => void | Promise<void>) | null,
    },
    tableActions: {
        edit: null as ((trade: Trade) => void) | null,
        update: null as ((id: number) => void | Promise<void>) | null,
        delete: null as ((id: number) => void | Promise<void>) | null,
    },
}));

vi.mock("../lib/supabase", () => ({
    supabase: {
        auth: {
            getSession: mockGetSession,
            signOut: mockSignOut,
            onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
                authCallback.current = callback;
                return mockOnAuthStateChange(callback);
            },
        },
    },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

vi.mock("../components/Sidebar", () => ({
    default: ({ userEmail, onLogout }: { userEmail: string | null; onLogout: () => void }) => (
        <div>
            <span data-testid="email">{userEmail ?? "no-email"}</span>
            <button type="button" onClick={onLogout}>Logout</button>
        </div>
    ),
}));

vi.mock("../components/TradeForm", () => ({
    default: ({
        setSymbol,
        setDirection,
        setEntry,
        setStop,
        setExit,
        setPnl,
        setEntryDatetime,
        setExitDatetime,
        onSave,
    }: {
        setSymbol: (value: string) => void;
        setDirection: (value: string) => void;
        setEntry: (value: string) => void;
        setStop: (value: string) => void;
        setExit: (value: string) => void;
        setPnl: (value: string) => void;
        setEntryDatetime: (value: string) => void;
        setExitDatetime: (value: string) => void;
        onSave: () => void | Promise<void>;
    }) => {
        formActions.fillValidTrade = () => {
            setSymbol("GBPUSD");
            setDirection("long");
            setEntry("1.25");
            setStop("1.24");
            setExit("1.27");
            setPnl("500");
            setEntryDatetime("2026-08-17T10:00");
            setExitDatetime("2026-08-17T11:00");
        };
        formActions.clearDates = () => {
            setEntryDatetime("");
            setExitDatetime("");
        };
        formActions.clearStop = () => setStop("");
        formActions.reverseDates = () => {
            setEntryDatetime("2026-08-17T11:00");
            setExitDatetime("2026-08-17T10:00");
        };
        formActions.save = onSave;
        return <div data-testid="trade-form">Trade form</div>;
    },
}));

vi.mock("../components/StatisticsCards", () => ({
    default: ({ statistics, startingBalance, currency }: {
        statistics: Statistics;
        startingBalance: number;
        currency: string;
    }) => <div data-testid="stats">{statistics.total_trades}-{startingBalance}-{currency}</div>,
}));

vi.mock("../components/PerformanceChart", () => ({
    default: ({ performance, totalTrades, tradesWithR, currency }: {
        performance: Statistics["performance"];
        totalTrades: number;
        tradesWithR: number;
        currency: string;
    }) => <div data-testid="chart">{performance.r.length}-{totalTrades}-{tradesWithR}-{currency}</div>,
}));

vi.mock("../components/TradingCalendar", () => ({
    default: ({ days, currency, onMonthChange }: {
        days: Array<{ date: string }>;
        currency: string;
        onMonthChange: (year: number, month: number) => void;
    }) => (
        <div data-testid="trading-calendar">
            {days.length}-{currency}
            <button
                type="button"
                onClick={() => onMonthChange(2026, 10)}
            >
                Change calendar month
            </button>
        </div>
    ),
}));

vi.mock("../components/TradesTable", () => ({
    default: ({ trades, editingTradeId, selectedAccountId, onEdit, onUpdate, onDelete }: {
        trades: Trade[];
        editingTradeId: number | null;
        selectedAccountId?: number | null;
        onEdit: (trade: Trade) => void;
        onUpdate: (id: number) => void | Promise<void>;
        onDelete: (id: number) => void | Promise<void>;
    }) => {
        tableActions.edit = onEdit;
        tableActions.update = onUpdate;
        tableActions.delete = onDelete;
        return (
            <div>
                <span data-testid="trade-count">{trades.length}</span>
                <span data-testid="account-id">{selectedAccountId ?? "none"}</span>
                {trades.map((trade) => <span key={trade[0]}>{trade[1]}</span>)}
                {editingTradeId !== null && <span>editing</span>}
            </div>
        );
    },
}));

const session = { access_token: "fake-token", user: { email: "test@example.com" } };
const account1: Account = {
    id: 7,
    user_id: "user-1",
    name: "FTMO",
    starting_balance: 100000,
    currency: "USD",
    broker: null,
    account_type: null,
};
const account2: Account = {
    ...account1,
    id: 8,
    name: "Personal",
    starting_balance: 20000,
    currency: "EUR",
};

const emptyCalendar = {
    total_trades: 0,
    trading_days: 0,
    total_pnl: 0,
    total_r: null,
    trades_with_r: 0,
    days: [],
};

function makeTrade(id = 1, symbol = "EURUSD", stop: number | null = 1.14, result: number | null = 2): Trade {
    return [id, symbol, "long", 1.15, stop, 1.17, result, 250, "2026-08-17T10:00", "2026-08-17T11:00"];
}

function apiResponse<T>(data: T, ok = true) {
    return { ok, json: async () => data } as Response;
}

function paginatedTrades(trades: Trade[]) {
    return { items: trades, page: 1, page_size: 5, total: trades.length, total_pages: trades.length > 0 ? 1 : 0 };
}

function statisticsFor(trades: Trade[]): Statistics {
    const tradesWithR = trades.filter((trade) => trade[6] !== null);
    const totalR = tradesWithR.reduce((total, trade) => total + trade[6]!, 0);
    const totalPnl = trades.reduce((total, trade) => total + trade[7], 0);
    return {
        total_trades: trades.length,
        winning_trades: trades.filter((trade) => trade[7] > 0).length,
        total_pnl: totalPnl,
        total_r: tradesWithR.length > 0 ? totalR : null,
        trades_with_r: tradesWithR.length,
        win_rate: trades.length > 0 ? trades.filter((trade) => trade[7] > 0).length / trades.length * 100 : 0,
        average_r: tradesWithR.length > 0 ? totalR / tradesWithR.length : null,
        performance: {
            r: tradesWithR.map((trade, index) => ({ trade_number: index + 1, value: trade[6]! })),
            pnl: trades.map((trade, index) => ({ trade_number: index + 1, value: trade[7] })),
        },
    };
}

let fetchMock: ReturnType<typeof vi.fn>;

function queueDashboardData(trades: Trade[]) {
    fetchMock.mockResolvedValueOnce(apiResponse(paginatedTrades(trades)));
    fetchMock.mockResolvedValueOnce(apiResponse(statisticsFor(trades)));
}

function queueCalendarData(data = emptyCalendar) {
    fetchMock.mockResolvedValueOnce(apiResponse(data));
}

function queueDashboard(accounts: Account[] = [account1], trades: Trade[] = [makeTrade()]) {
    fetchMock.mockResolvedValueOnce(apiResponse(accounts));
    if (accounts.length > 0) {
        queueDashboardData(trades);
        queueCalendarData();
    }
}

async function renderDashboard(accounts: Account[] = [account1], trades: Trade[] = [makeTrade()]) {
    queueDashboard(accounts, trades);
    render(<Home />);
    await screen.findByRole("heading", { name: "Dashboard" });
    if (accounts.length > 0) {
        await waitFor(() => expect(screen.getByTestId("trade-count")).toHaveTextContent(String(trades.length)));
    } else {
        await screen.findByText("Create a trading account before adding trades.");
    }
}

async function openForm() {
    fireEvent.click(screen.getByRole("button", { name: "+ Add Trade" }));
    await screen.findByTestId("trade-form");
}

async function fillValidTrade() {
    await act(async () => formActions.fillValidTrade!());
}

async function saveTrade() {
    await act(async () => formActions.save!());
}

async function editTrade(trade: Trade = makeTrade()) {
    await act(async () => tableActions.edit!(trade));
}

async function updateTrade(id = 1) {
    await act(async () => tableActions.update!(id));
}

async function deleteTrade(id = 1) {
    await act(async () => tableActions.delete!(id));
}

describe("dashboard page", () => {
    beforeEach(() => {
        fetchMock = vi.fn();
        fetchMock.mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes("/calendar?")) return apiResponse(emptyCalendar);
            if (url.includes("/statistics")) return apiResponse(statisticsFor([]));
            if (url.includes("/trades?")) return apiResponse(paginatedTrades([]));
            return apiResponse([]);
        });
        vi.stubGlobal("fetch", fetchMock);

        [mockGetSession, mockSignOut, mockOnAuthStateChange, mockUnsubscribe, mockPush]
            .forEach((mock) => mock.mockReset());
        mockGetSession.mockResolvedValue({ data: { session } });
        mockSignOut.mockResolvedValue(undefined);
        mockOnAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe: mockUnsubscribe } },
        });
        authCallback.current = null;
        formActions.fillValidTrade = null;
        formActions.clearDates = null;
        formActions.clearStop = null;
        formActions.reverseDates = null;
        formActions.save = null;
        tableActions.edit = null;
        tableActions.update = null;
        tableActions.delete = null;
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test("loads user, accounts, recent trades and statistics", async () => {
        await renderDashboard();
        expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
        expect(screen.getByTestId("stats")).toHaveTextContent("1-100000-USD");
        expect(screen.getByTestId("chart")).toHaveTextContent("1-1-1-USD");
        expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/accounts", expect.anything());
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/trades?account_id=7&page=1&page_size=5",
            expect.anything()
        );
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/statistics?account_id=7",
            expect.anything()
        );
    });

    test("loads the trading calendar for the selected account", async () => {
        const today = new Date();
        const calendarData = {
            total_trades: 1,
            trading_days: 1,
            total_pnl: 250,
            total_r: 2,
            trades_with_r: 1,
            days: [{
                date: "2026-09-12",
                total_trades: 1,
                total_pnl: 250,
                total_r: 2,
                trades_with_r: 1,
            }],
        };

        fetchMock.mockImplementation(async (input) => {
            const url = String(input);
            if (url.endsWith("/accounts")) return apiResponse([account1]);
            if (url.includes("/trades?")) return apiResponse(paginatedTrades([makeTrade()]));
            if (url.includes("/statistics?")) return apiResponse(statisticsFor([makeTrade()]));
            if (url.includes("/calendar?")) return apiResponse(calendarData);
            return apiResponse([]);
        });

        render(<Home />);

        expect(await screen.findByTestId("trading-calendar")).toHaveTextContent("1-USD");
        expect(fetchMock).toHaveBeenCalledWith(
            `http://127.0.0.1:8000/calendar?account_id=7&year=${today.getFullYear()}&month=${today.getMonth() + 1}`,
            expect.anything()
        );
    });

    test("loads another calendar month", async () => {
        await renderDashboard();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Change calendar month",
            })
        );

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                "http://127.0.0.1:8000/calendar?account_id=7&year=2026&month=10",
                expect.anything()
            )
        );
    });

    test("redirects when initial session is missing", async () => {
        mockGetSession.mockResolvedValueOnce({ data: { session: null } });
        render(<Home />);
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });

    test("uses null email when initial session has no email", async () => {
        mockGetSession.mockResolvedValue({ data: { session: { ...session, user: {} } } });
        await renderDashboard();
        expect(screen.getByTestId("email")).toHaveTextContent("no-email");
    });

    test.each([
        { ...session, user: { email: "new@example.com" } },
        { ...session, user: {} },
    ])("handles authenticated auth state change", async (authSession) => {
        await renderDashboard();
        await act(async () => authCallback.current!("SIGNED_IN", authSession));
        expect(mockPush).not.toHaveBeenCalledWith("/login");
    });

    test("redirects when auth state loses session", async () => {
        await renderDashboard();
        await act(async () => authCallback.current!("SIGNED_OUT", null));
        expect(mockPush).toHaveBeenCalledWith("/login");
    });

    test("unsubscribes auth listener", async () => {
        queueDashboard();
        const { unmount } = render(<Home />);
        await waitFor(() => expect(authCallback.current).not.toBeNull());
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    test("handles empty accounts", async () => {
        await renderDashboard([], []);
        expect(screen.getByRole("button", { name: "+ Add Trade" })).toBeDisabled();
        expect(screen.getByTestId("stats")).toHaveTextContent("0-0-");
    });

    test.each(["accounts", "trades", "statistics", "calendar"])("handles failed %s request", async (request) => {
        if (request === "accounts") {
            fetchMock.mockResolvedValueOnce(apiResponse([], false));
        } else {
            fetchMock.mockResolvedValueOnce(apiResponse([account1]));
            fetchMock.mockResolvedValueOnce(
                request === "trades" ? apiResponse({}, false) : apiResponse(paginatedTrades([]))
            );
            fetchMock.mockResolvedValueOnce(
                request === "statistics" ? apiResponse({}, false) : apiResponse(statisticsFor([]))
            );
            fetchMock.mockResolvedValueOnce(
                request === "calendar" ? apiResponse({}, false) : apiResponse(emptyCalendar)
            );
        }
        render(<Home />);
        await screen.findByRole("heading", { name: "Dashboard" });
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(request === "accounts" ? 1 : 4));
        expect(screen.getByTestId("trade-count")).toHaveTextContent("0");
    });

    test("changes selected account", async () => {
        fetchMock.mockResolvedValueOnce(apiResponse([account1, account2]));
        queueDashboardData([makeTrade()]);
        queueCalendarData();
        queueDashboardData([makeTrade(2, "GBPUSD")]);
        queueCalendarData();
        render(<Home />);
        await screen.findByText("EURUSD");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "8" } });
        expect(await screen.findByText("GBPUSD")).toBeInTheDocument();
        expect(screen.getByTestId("stats")).toHaveTextContent("1-20000-EUR");
    });

    test("keeps selected account when session refreshes", async () => {
        fetchMock.mockImplementation(async (input) => {
            const url = String(input);
            if (url.endsWith("/accounts")) return apiResponse([account1, account2]);
            const selectedTrades = url.includes("account_id=8") ? [makeTrade(2, "GBPUSD")] : [makeTrade()];
            if (url.includes("/calendar?")) return apiResponse(emptyCalendar);
            return url.includes("/statistics")
                ? apiResponse(statisticsFor(selectedTrades))
                : apiResponse(paginatedTrades(selectedTrades));
        });
        render(<Home />);
        await screen.findByText("EURUSD");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "8" } });
        await screen.findByText("GBPUSD");
        await act(async () => authCallback.current!("TOKEN_REFRESHED", { ...session, access_token: "refreshed-token" }));
        await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("8"));
    });

    test("opens and closes trade form", async () => {
        await renderDashboard();
        await openForm();
        expect(screen.getByTestId("trade-form")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "+ Add Trade" }));
        expect(screen.queryByTestId("trade-form")).not.toBeInTheDocument();
    });

    test("creates trade", async () => {
        queueDashboard([account1], []);
        fetchMock.mockResolvedValueOnce(apiResponse({}));
        queueDashboardData([makeTrade(1, "GBPUSD")]);
        render(<Home />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
        await openForm();
        await fillValidTrade();
        await saveTrade();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/trades",
            expect.objectContaining({ method: "POST" })
        );
        await waitFor(() => expect(screen.queryByTestId("trade-form")).not.toBeInTheDocument());
    });

    test("creates trade without stop", async () => {
        const createdTrade = makeTrade(1, "GBPUSD", null, null);
        queueDashboard([account1], []);
        fetchMock.mockResolvedValueOnce(apiResponse({}));
        queueDashboardData([createdTrade]);
        render(<Home />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
        await openForm();
        await fillValidTrade();
        await act(async () => formActions.clearStop!());
        await saveTrade();
        const createCall = fetchMock.mock.calls.find(([url, options]) =>
            url === "http://127.0.0.1:8000/trades" && options?.method === "POST"
        );
        expect(JSON.parse(createCall![1].body as string)).toMatchObject({ stop: null });
    });

    test("does not create trade without dates", async () => {
        await renderDashboard();
        await openForm();
        await act(async () => formActions.clearDates!());
        await saveTrade();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(screen.getByText("Please fill in all required fields.")).toBeInTheDocument();
    });

    test("does not create trade when exit date is before entry date", async () => {
        await renderDashboard();
        await openForm();
        await fillValidTrade();
        await act(async () => formActions.reverseDates!());
        await saveTrade();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(screen.getByText("Exit date cannot be before entry date.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "OK" }));
        expect(screen.queryByText("Exit date cannot be before entry date.")).not.toBeInTheDocument();
    });

    test("redirects when create session disappears", async () => {
        await renderDashboard();
        await openForm();
        await fillValidTrade();
        mockGetSession.mockResolvedValueOnce({ data: { session: null } });
        await saveTrade();
        expect(mockPush).toHaveBeenCalledWith("/login");
    });

    test("keeps form open when create fails", async () => {
        queueDashboard([account1], []);
        fetchMock.mockResolvedValueOnce(apiResponse({}, false));
        render(<Home />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
        await openForm();
        await fillValidTrade();
        await saveTrade();
        expect(screen.getByTestId("trade-form")).toBeInTheDocument();
    });

    test("edits and updates trade", async () => {
        queueDashboard();
        fetchMock.mockResolvedValueOnce(apiResponse({}));
        queueDashboardData([makeTrade()]);
        render(<Home />);
        await screen.findByText("EURUSD");
        await editTrade();
        expect(screen.getByText("editing")).toBeInTheDocument();
        await updateTrade();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/trades/1",
            expect.objectContaining({ method: "PATCH" })
        );
    });

    test("edits and updates trade without stop", async () => {
        const tradeWithoutStop = makeTrade(1, "EURUSD", null, null);
        queueDashboard([account1], [tradeWithoutStop]);
        fetchMock.mockResolvedValueOnce(apiResponse({}));
        queueDashboardData([tradeWithoutStop]);
        render(<Home />);
        await screen.findByText("EURUSD");
        await editTrade(tradeWithoutStop);
        await updateTrade();
        const updateCall = fetchMock.mock.calls.find(([url, options]) =>
            url === "http://127.0.0.1:8000/trades/1" && options?.method === "PATCH"
        );
        expect(JSON.parse(updateCall![1].body as string)).toMatchObject({ stop: null });
    });

    test("does not update without dates", async () => {
        const invalidTrade: Trade = [1, "EURUSD", "long", 1, 1, 1, 1, 1, "", ""];
        await renderDashboard([account1], [invalidTrade]);
        await editTrade(invalidTrade);
        await updateTrade();
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    test("redirects when update session disappears", async () => {
        await renderDashboard();
        await editTrade();
        mockGetSession.mockResolvedValueOnce({ data: { session: null } });
        await updateTrade();
        expect(mockPush).toHaveBeenCalledWith("/login");
    });

    test("handles failed update", async () => {
        queueDashboard();
        fetchMock.mockResolvedValueOnce(apiResponse({}, false));
        render(<Home />);
        await screen.findByText("EURUSD");
        await editTrade();
        await updateTrade();
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    test("deletes trade and reloads dashboard", async () => {
        queueDashboard();
        fetchMock.mockResolvedValueOnce(apiResponse({}));
        queueDashboardData([]);
        render(<Home />);
        await screen.findByText("EURUSD");
        await deleteTrade();
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/trades/1",
            expect.objectContaining({ method: "DELETE" })
        );
        await waitFor(() => expect(screen.queryByText("EURUSD")).not.toBeInTheDocument());
    });

    test("redirects when delete session disappears", async () => {
        await renderDashboard();
        mockGetSession.mockResolvedValueOnce({ data: { session: null } });
        await deleteTrade();
        expect(mockPush).toHaveBeenCalledWith("/login");
    });

    test("handles failed delete", async () => {
        queueDashboard();
        fetchMock.mockResolvedValueOnce(apiResponse({}, false));
        render(<Home />);
        await screen.findByText("EURUSD");
        await deleteTrade();
        expect(screen.getByText("EURUSD")).toBeInTheDocument();
    });

    test("filters dashboard with date presets", async () => {
        await renderDashboard();

        fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));

        const thirtyDayUrl = new URL(String(fetchMock.mock.calls[4][0]));
        const thirtyDayFrom = new Date(thirtyDayUrl.searchParams.get("date_from")!);
        const thirtyDayTo = new Date(thirtyDayUrl.searchParams.get("date_to")!);
        expect((thirtyDayTo.getTime() - thirtyDayFrom.getTime()) / 86_400_000).toBe(29);
        expect(String(fetchMock.mock.calls[5][0])).toContain(
            `date_from=${thirtyDayUrl.searchParams.get("date_from")}&date_to=${thirtyDayUrl.searchParams.get("date_to")}`
        );

        fireEvent.click(screen.getByRole("button", { name: "Last 90 days" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(8));

        const ninetyDayUrl = new URL(String(fetchMock.mock.calls[6][0]));
        const ninetyDayFrom = new Date(ninetyDayUrl.searchParams.get("date_from")!);
        const ninetyDayTo = new Date(ninetyDayUrl.searchParams.get("date_to")!);
        expect((ninetyDayTo.getTime() - ninetyDayFrom.getTime()) / 86_400_000).toBe(89);

        fireEvent.click(screen.getByRole("button", { name: "All time" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));
        expect(fetchMock.mock.calls[8][0]).toBe(
            "http://127.0.0.1:8000/trades?account_id=7&page=1&page_size=5"
        );
        expect(fetchMock.mock.calls[9][0]).toBe(
            "http://127.0.0.1:8000/statistics?account_id=7"
        );
    });

    test("waits for a complete valid custom date range", async () => {
        await renderDashboard();
        expect(fetchMock).toHaveBeenCalledTimes(4);

        fireEvent.click(screen.getByRole("button", { name: "Custom" }));
        fireEvent.change(screen.getByLabelText("From"), {
            target: { value: "2026-08-01" },
        });
        expect(fetchMock).toHaveBeenCalledTimes(4);

        fireEvent.change(screen.getByLabelText("To"), {
            target: { value: "2026-08-31" },
        });
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/trades?account_id=7&page=1&page_size=5&date_from=2026-08-01&date_to=2026-08-31",
            expect.anything()
        );
        expect(fetchMock).toHaveBeenCalledWith(
            "http://127.0.0.1:8000/statistics?account_id=7&date_from=2026-08-01&date_to=2026-08-31",
            expect.anything()
        );

        fireEvent.change(screen.getByLabelText("From"), {
            target: { value: "2026-09-05" },
        });
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Start date cannot be after end date."
        );
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    test("logs out", async () => {
        await renderDashboard();
        fireEvent.click(screen.getByRole("button", { name: "Logout" }));
        await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
        expect(mockPush).toHaveBeenCalledWith("/login");
    });
});
