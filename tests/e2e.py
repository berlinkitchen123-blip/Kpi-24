"""Clicks every button in the demo build, in all three roles, desktop + phone.
Run: npx vite build --mode preview && python3 tests/e2e.py
"""
import re, sys, os, struct, zlib
from playwright.sync_api import sync_playwright, expect, Page

URL = "file://" + os.path.abspath("dist-preview/index.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
errors: list[str] = []
passed: list[str] = []


def ok(name):
    passed.append(name)
    print("  ✓", name)


def png(path):
    """Write a tiny valid PNG to use as a receipt photo."""
    raw = b"".join(b"\x00" + b"\xff\x80\x40" * 8 for _ in range(8))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)
    return path


RECEIPT = png(os.path.join(OUT, "receipt.png"))


def new_page(b, vp, who) -> Page:
    pg = b.new_page(viewport=vp, accept_downloads=True)
    pg.on("pageerror", lambda e: errors.append(f"[{who}] pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and errors.append(f"[{who}] console: {m.text}"))
    pg.goto(URL)
    pg.get_by_role("button", name=re.compile(who)).click()
    return pg


def nav(pg, label):
    pg.locator("aside").get_by_role("link", name=re.compile(label)).click()


def toast(pg):
    return pg.get_by_role("status")


def manager(b):
    print("City Manager (desktop)")
    pg = new_page(b, {"width": 1400, "height": 950}, "Harsh")
    expect(pg.get_by_role("heading", name=re.compile("Good"))).to_be_visible()

    # Order: to-do list is above KPIs
    todo_y = pg.get_by_role("heading", name="To-do").bounding_box()["y"]
    kpi_y = pg.get_by_role("heading", name="This month").bounding_box()["y"]
    assert todo_y < kpi_y; ok("to-do list shown above KPIs")

    # Attention strip
    pg.get_by_role("link", name=re.compile("waiting for approval")).click()
    expect(pg.get_by_role("heading", name="Approvals")).to_be_visible(); ok("attention → approvals")
    nav(pg, "Home")
    pg.get_by_role("link", name=re.compile("missing receipt")).click()
    expect(pg.get_by_role("button", name=re.compile("Missing receipt"))).to_have_attribute("aria-pressed", "true"); ok("attention → missing receipts filter")
    nav(pg, "Home")

    # To-do filters
    for f, n in [("Email", 3), ("Teams", 2), ("Manual", 1), ("All", 6)]:
        pg.get_by_role("button", name=re.compile(f"^{f} ")).click()
        expect(pg.locator("li", has=pg.get_by_label("Mark done"))).to_have_count(n)
    ok("to-do filters All/Email/Teams/Manual")

    # Mark done + undo
    boxes = pg.get_by_label("Mark done")
    n = boxes.count()
    boxes.first.click()
    expect(boxes).to_have_count(n - 1)
    pg.get_by_role("button", name="Undo").click()
    expect(boxes).to_have_count(n); ok("mark done + undo")

    # Snooze options
    for opt in ["Tomorrow 08:00", "In 3 days", "Next Monday"]:
        pg.get_by_label("Snooze").first.click()
        pg.get_by_role("button", name=opt).click()
    expect(pg.get_by_role("button", name=re.compile(r"3 snoozed"))).to_be_visible(); ok("snooze: tomorrow / 3 days / next Monday")

    # Expand + reopen
    pg.get_by_role("button", name=re.compile("snoozed ·")).click()
    for _ in range(4):  # 3 snoozed + 1 already done
        pg.get_by_role("button", name="Reopen").first.click()
    expect(pg.get_by_role("button", name=re.compile("snoozed ·"))).to_have_count(0); ok("reopen snoozed and done tasks")

    # Add task: cancel, then add
    pg.get_by_role("button", name="Task").click()
    pg.get_by_role("button", name="Cancel").click()
    expect(pg.get_by_placeholder("What needs doing?")).to_have_count(0)
    pg.get_by_role("button", name="Task").click()
    pg.get_by_placeholder("What needs doing?").fill("Call landlord about heating")
    pg.get_by_label("High").check()
    pg.get_by_placeholder("What needs doing?").press("Enter")
    expect(pg.get_by_text("Call landlord about heating")).to_be_visible(); ok("add task (cancel + enter)")

    pg.get_by_label("Simulate sync").click()
    expect(pg.get_by_text(re.compile("synced just now"))).to_be_visible(); ok("sync refresh")

    # KPI card + budget drill-down
    pg.get_by_role("link", name=re.compile("Cost per dish")).first.click()
    expect(pg.get_by_role("heading", name="KPIs")).to_be_visible(); ok("KPI card → KPIs page")
    nav(pg, "Home")
    pg.get_by_role("link", name=re.compile("^Temporary food")).last.click()
    expect(pg.get_by_label("Category filter")).to_have_value("tempfood"); ok("budget bar → expenses filtered by category")
    pg.get_by_role("link", name="Home").first.click()
    pg.get_by_role("link", name="All KPIs").click()
    expect(pg.get_by_role("heading", name="KPIs")).to_be_visible(); ok("All KPIs link")

    # ---- Quick Add ----
    nav(pg, "Quick Add")
    save = pg.get_by_role("button", name="Save expense")
    save.click(); expect(pg.get_by_role("alert")).to_have_text("Enter an amount.")
    pg.get_by_label("Amount").fill("62,40")
    save.click(); expect(pg.get_by_role("alert")).to_have_text("Pick a category.")
    pg.get_by_role("button", name="Fuel", exact=True).click()
    save.click(); expect(pg.get_by_role("alert")).to_have_text("Enter the supplier.")
    pg.get_by_label("Supplier").fill("Shell")
    save.click(); expect(pg.get_by_role("alert")).to_have_text("Pick the vehicle."); ok("quick add validation (amount, category, supplier, vehicle)")
    pg.get_by_role("button", name="Van 2").click()
    pg.get_by_role("button", name="Yesterday").click()
    pg.get_by_role("button", name="Today").click()
    pg.get_by_role("radio", name="7 %").click(); pg.get_by_role("radio", name="19 %").click()
    expect(pg.get_by_text(re.compile(r"net 52,44"))).to_be_visible(); ok("VAT split shown (19 %)")
    for m in ["Cash", "Bank", "Invoice", "Card"]:
        pg.get_by_role("radio", name=m).click()
    pg.get_by_label("Receipt file").set_input_files(RECEIPT)
    expect(pg.get_by_text("Receipt attached")).to_be_visible()
    pg.get_by_label("Remove receipt").click()
    pg.get_by_label("Receipt file").set_input_files(RECEIPT)
    expect(pg.get_by_text("Receipt attached")).to_be_visible(); ok("receipt photo attach / remove / re-attach")
    pg.get_by_label("Note").fill("Test fill-up")
    save.click()
    expect(toast(pg)).to_contain_text(re.compile(r"Saved: EUR 62\.40, Fuel, Van 2, \d+ \w+")); ok("save → 'Saved: EUR 62.40, Fuel, Van 2, <date>'")
    expect(pg.get_by_text("Added today")).to_be_visible()
    pg.get_by_role("button", name="Undo").click()
    expect(pg.get_by_text("Added today")).to_have_count(0); ok("undo last entry")
    # Save again for later checks
    pg.get_by_label("Amount").fill("143,90")
    pg.get_by_role("button", name="Non-food", exact=True).click()
    pg.get_by_role("button", name="Cleaning").click()
    pg.get_by_label("Supplier").fill("METRO Essen")
    save.click()
    expect(toast(pg)).to_contain_text("Saved: EUR 143.90, Non-food"); ok("second entry (METRO cleaning 143,90)")

    # ---- Expenses list ----
    nav(pg, "Expenses")
    expect(pg.get_by_text("METRO Essen").first).to_be_visible()
    pg.get_by_label("Previous month").click(); pg.get_by_label("Next month").click()
    expect(pg.get_by_label("Next month")).to_be_disabled(); ok("month picker prev/next, future blocked")
    pg.get_by_label("Category filter").select_option("fuel")
    expect(pg.locator("tbody tr").first).to_contain_text("Fuel")
    pg.get_by_label("Category filter").select_option("")
    pg.get_by_label("Search").fill("stadtwerke")
    expect(pg.locator("tbody tr").first).to_contain_text("Stadtwerke")
    pg.get_by_label("Search").fill(""); ok("category filter + search")
    pg.get_by_role("button", name=re.compile("Missing receipt")).click()
    for r in pg.locator("tbody tr").all():
        expect(r).to_contain_text("none")
    pg.get_by_role("button", name=re.compile("Missing receipt")).click()
    pg.get_by_role("button", name=re.compile("^Pending")).click()
    expect(pg.locator("tbody tr")).to_have_count(1)
    pg.get_by_role("button", name=re.compile("^Pending")).click(); ok("missing-receipt + pending toggles")
    pg.get_by_role("button", name="Amount").click()
    a1 = pg.locator("tbody tr td:last-child").first.inner_text()
    pg.get_by_role("button", name="Amount").click()
    a2 = pg.locator("tbody tr td:last-child").first.inner_text()
    assert a1 != a2
    pg.get_by_role("button", name="Supplier").click(); pg.get_by_role("button", name="Date").click(); ok("sort by amount / supplier / date")
    with pg.expect_download() as d:
        pg.get_by_role("button", name="CSV").click()
    assert d.value.suggested_filename.startswith("expenses-"); ok("CSV export downloads")

    # Drawer: open, edit, save
    pg.locator("tbody tr", has_text="METRO Essen").filter(has_text="143,90").click()
    dlg = pg.get_by_role("dialog")
    expect(dlg).to_contain_text("143,90")
    dlg.get_by_role("button", name="Edit").click()
    dlg.get_by_label("Amount").fill("150")
    dlg.get_by_role("button", name="Save changes").click()
    expect(toast(pg)).to_have_text("Changes saved")
    expect(dlg).to_contain_text("150,00"); ok("drawer edit + save")
    dlg.get_by_role("button", name="Delete").click()
    dlg.get_by_role("button", name="Confirm delete").click()
    expect(pg.get_by_role("dialog")).to_have_count(0)
    pg.get_by_role("button", name="Undo").click()
    expect(pg.locator("tbody tr", has_text="150,00").first).to_be_visible(); ok("delete (confirm) + undo")
    pg.locator("tbody tr").first.click(); pg.get_by_label("Close").click()
    expect(pg.get_by_role("dialog")).to_have_count(0)
    pg.locator("tbody tr").first.click(); pg.keyboard.press("Escape")
    expect(pg.get_by_role("dialog")).to_have_count(0); ok("drawer close button + Escape")
    # Approve from drawer
    pg.get_by_role("button", name=re.compile("^Pending")).click()
    pg.locator("tbody tr").first.click()
    pg.get_by_role("dialog").get_by_role("button", name="Approve").click()
    expect(toast(pg)).to_have_text("Approved"); pg.keyboard.press("Escape")
    expect(pg.locator("tbody tr")).to_have_count(0); ok("approve in drawer")
    pg.get_by_role("button", name=re.compile("^Pending")).click()

    # ---- Suppliers ----
    nav(pg, "Suppliers")
    for p in ["This month", "6 months", "3 months"]:
        pg.get_by_role("radio", name=p).click()
    pg.get_by_role("button", name=re.compile("^Sixt Leasing")).click()
    expect(pg.get_by_label("Search")).to_have_value("Sixt Leasing"); ok("suppliers period + row → filtered expenses")

    # ---- Budgets ----
    nav(pg, "Budgets")
    pg.get_by_label("Next month").click()
    pg.get_by_role("button", name="Copy last month").click()
    expect(pg.get_by_label("Budget Employees")).to_have_value("20000")
    pg.get_by_role("button", name="Save budget").click()
    expect(toast(pg)).to_contain_text("Budget saved"); ok("next month: copy last month + save")
    pg.get_by_label("Previous month").click()
    pg.get_by_label("Budget Fuel").fill("abc")
    expect(pg.get_by_role("button", name="Save budget")).to_be_disabled()
    pg.get_by_label("Budget Fuel").fill("1500")
    pg.get_by_role("button", name="Save budget").click()
    expect(toast(pg)).to_contain_text("Budget saved"); ok("invalid budget blocks save; edit + save")
    pg.get_by_label("Dishes sold").fill("5000")
    pg.get_by_role("button", name="Save revenue").click()
    expect(toast(pg)).to_contain_text("Revenue saved"); ok("revenue save")

    # ---- KPIs reflect new dishes ----
    nav(pg, "KPIs")
    expect(pg.get_by_text("5.000", exact=True)).to_be_visible(); ok("KPIs recalculated from new dishes sold")
    pg.get_by_label("Previous month").click()
    expect(pg.get_by_text("Total spend")).to_be_visible()
    pg.get_by_label("Next month").click()
    pg.locator("table").get_by_role("link", name="Logistics").click()
    expect(pg.get_by_label("Category filter")).to_have_value("logistics"); ok("KPI month nav + category drill-down")

    # ---- Approvals ----
    nav(pg, "Approvals")
    expect(pg.get_by_text("Nothing waiting for approval.")).to_be_visible(); ok("approvals empty state")

    # ---- Settings ----
    nav(pg, "Settings")
    pg.get_by_label("Approval limit").fill("150")
    pg.get_by_role("button", name="Save", exact=True).click()
    expect(toast(pg)).to_contain_text("EUR 150")
    pg.get_by_placeholder("name@company.com").fill("bad")
    pg.get_by_role("button", name="Assign").click()
    expect(pg.get_by_text("Enter a valid email.")).to_be_visible()
    pg.get_by_placeholder("name@company.com").fill("new.driver@example.com")
    pg.get_by_role("button", name="Assign").click()
    expect(pg.get_by_text(re.compile("would get"))).to_be_visible(); ok("settings: approval limit + assign role")

    # ---- Placeholder screens ----
    for label in ["Fuel & Vehicles", "Employees", "Utilities", "Reports", "Month Close", "Audit Log"]:
        nav(pg, label)
        expect(pg.get_by_text(re.compile("Coming in Phase"))).to_be_visible()
    ok("all later-phase screens open")

    # ---- City switch ----
    pg.get_by_label("City").select_option("dortmund")
    nav(pg, "Home")
    expect(pg.get_by_text("Nothing open. Clear desk.")).to_be_visible()
    pg.get_by_label("City").select_option("essen"); ok("switch city (empty city works)")

    pg.screenshot(path=f"{OUT}/t-manager-home.png", full_page=True)
    nav(pg, "Expenses"); pg.screenshot(path=f"{OUT}/t-expenses.png", full_page=True)
    nav(pg, "KPIs"); pg.screenshot(path=f"{OUT}/t-kpis.png", full_page=True)
    nav(pg, "Budgets"); pg.screenshot(path=f"{OUT}/t-budgets.png", full_page=True)
    nav(pg, "Suppliers"); pg.screenshot(path=f"{OUT}/t-suppliers.png", full_page=True)

    pg.locator("aside").get_by_role("button", name="Sign out").click()
    expect(pg.get_by_text("Sign in to continue")).to_be_visible(); ok("sign out")
    pg.close()


def staff(b):
    print("Staff / driver (phone)")
    pg = new_page(b, {"width": 390, "height": 844}, "Driver")
    bottom = pg.locator("nav.fixed")
    expect(bottom.get_by_role("link")).to_have_count(3)  # Home, Quick Add, Expenses
    ok("driver sees only Home / Quick Add / Expenses")
    expect(pg.get_by_role("heading", name="To-do")).to_have_count(0); ok("driver has no to-do list or KPIs")
    pg.get_by_role("link", name=re.compile("Add expense")).click()
    pg.get_by_label("Amount").fill("238,50")
    pg.get_by_role("button", name="Logistics", exact=True).click()
    pg.get_by_role("button", name="Repairs").click()
    pg.get_by_role("button", name="Van 1").click()
    pg.get_by_label("Supplier").fill("ATU Essen")
    expect(pg.get_by_text(re.compile("will wait for the City Manager"))).to_be_visible()
    pg.get_by_label("Receipt file").set_input_files(RECEIPT)
    expect(pg.get_by_text("Receipt attached")).to_be_visible()
    pg.get_by_role("button", name="Save expense").click()
    expect(toast(pg)).to_contain_text("(awaiting approval)"); ok("driver above limit → pending, receipt photo on phone")
    pg.screenshot(path=f"{OUT}/t-staff-quickadd.png", full_page=True)
    bottom.get_by_role("link", name="Expenses").click()
    rows = pg.locator("ul.md\\:hidden li")
    for r in rows.all():
        expect(r).not_to_contain_text("Vermieter")
    ok("driver sees only own entries")
    rows.first.click()
    expect(pg.get_by_role("dialog").get_by_role("button", name="Edit")).to_have_count(0); ok("driver cannot edit/delete")
    pg.keyboard.press("Escape")
    pg.goto(URL + "#/budgets")
    expect(pg.get_by_role("heading", name=re.compile("Good"))).to_be_visible(); ok("driver blocked from /budgets (redirect)")
    pg.close()


def management(b):
    print("Management (read-only)")
    pg = new_page(b, {"width": 1280, "height": 900}, "Management")
    expect(pg.get_by_role("heading", name="To-do")).to_have_count(0)
    expect(pg.locator("aside").get_by_role("link", name=re.compile("Quick Add"))).to_have_count(0); ok("management: no to-do, no Quick Add")
    nav(pg, "Budgets")
    expect(pg.get_by_label("Budget Employees")).to_be_disabled()
    expect(pg.get_by_role("button", name="Save budget")).to_have_count(0); ok("management: budgets read-only")
    nav(pg, "Expenses")
    pg.locator("tbody tr").first.click()
    expect(pg.get_by_role("dialog").get_by_role("button", name="Edit")).to_have_count(0); ok("management: expenses read-only")
    pg.close()


def manager_phone(b):
    print("City Manager (phone)")
    pg = new_page(b, {"width": 390, "height": 844}, "Harsh")
    bottom = pg.locator("nav.fixed")
    for label, check in [("Quick Add", "Save expense"), ("Expenses", "CSV"), ("KPIs", None), ("Home", None)]:
        bottom.get_by_role("link", name=label).click()
        if check:
            expect(pg.get_by_role("button", name=check)).to_be_visible()
    ok("phone bottom navigation")
    w = pg.evaluate("document.documentElement.scrollWidth")
    assert w <= 390, f"horizontal scroll: {w}"; ok("no horizontal scroll on phone")
    pg.screenshot(path=f"{OUT}/t-phone-home.png", full_page=True)
    pg.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for fn in (manager, staff, management, manager_phone):
        try:
            fn(b)
        except Exception as e:
            errors.append(f"{fn.__name__} FAILED: {e}")
            print("  ✗", str(e).splitlines()[0])
    b.close()

print(f"\n{len(passed)} checks passed, {len(errors)} problems")
for e in errors:
    print(" -", e[:400])
sys.exit(1 if errors else 0)
