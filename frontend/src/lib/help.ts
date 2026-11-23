/**
 * User guide content. One source for:
 *  - the ⓘ "How this page works" drawer on every admin page (components/admin/HelpButton.tsx)
 *  - the PDF handbook (docs/handbook/build-handbook.mjs prints it with the same screenshots)
 * Pictures live in frontend/public/help/ (drawn .svg illustrations from docs/handbook/illustrations.mjs, plus .jpg screenshots).
 * Blocks with `perm` only show in the app to people who have that permission, and are left out of the
 * Admin handbook (which describes what an Admin can do).
 */

export interface HelpBlock {
  heading: string;
  text?: string;
  steps?: string[];
  tips?: string[];
  image?: string;
  caption?: string;
  /** Only for people with this permission (Developer-only features) */
  perm?: string;
}

export interface HelpTopic {
  key: string;
  title: string;
  /** Admin route this topic belongs to; the info button picks the topic by the current path */
  path?: string;
  summary: string;
  blocks: HelpBlock[];
}

export const HELP: HelpTopic[] = [
  {
    key: "getting-started",
    title: "Signing in for the first time",
    path: "/admin/setup",
    summary: "How to sign in, and the three short steps every new account completes before using the admin panel.",
    blocks: [
      {
        heading: "Sign in",
        image: "login.jpg",
        caption: "The sign-in page at /admin/login",
        steps: [
          "Open the admin panel address you were given (it ends in /admin).",
          "Enter your username or your email address, and your password.",
          "Select Sign in. If two-factor sign-in is on for your account, enter the 6-digit code from your authenticator app next.",
        ],
        tips: [
          "Lost your phone? Choose “Use a recovery code” and enter one of the codes you saved when you set up two-factor sign-in.",
          "After several wrong passwords, sign-in is locked for a few minutes. Wait, then try again, or ask another Admin to reset your password.",
        ],
      },
      {
        heading: "Complete your account",
        image: "setup.svg",
        caption: "First sign-in: choose a password, add your details, and set up two-factor sign-in if it's required",
        text: "New accounts, and accounts whose password was reset, start with a temporary password. The panel asks you to finish these steps before anything else:",
        steps: [
          "Choose your own password. It must have upper and lower case letters, a number and a symbol.",
          "Enter your display name and email address.",
          "If two-factor sign-in is required, scan the QR code with an authenticator app (such as Google Authenticator or Microsoft Authenticator), enter the 6-digit code, and save your recovery codes somewhere safe.",
        ],
      },
      {
        heading: "Find your way around",
        image: "dashboard.svg",
        caption: "The menu on the left lists every area you can use",
        text: "The menu on the left only shows what your role can use. Every page has an ⓘ button next to its title that opens these instructions. Your name at the top right opens My profile and Sign out. You are signed out automatically after a period without activity (set in Settings → Security).",
      },
    ],
  },
  {
    key: "tester",
    title: "The responsive tester (public site)",
    summary: "What visitors see, so you can explain it and check your changes.",
    blocks: [
      {
        heading: "Checking a website on many screens",
        image: "tester.jpg",
        caption: "The public tester: paste a link, pick a menu group, switch between Scroll and Grid",
        steps: [
          "Paste a website address in the box at the top and select Show.",
          "Pick a menu group (for example Popular, iPhone or Tablets) to see its devices.",
          "Click the arrow on the active menu group to tick only the devices you want to compare.",
          "Use View to switch between Scroll (one row you can drag sideways) and Grid (rows of cards, with S/M/L card sizes).",
          "Use Size: True scale shows real size differences; Fill height makes every device the same height.",
          "At the bottom: Scroll inside pages, Landscape, and Reload pages. Click a device name to open it large.",
        ],
        tips: [
          "The address bar always holds the current view, so copying it shares exactly what you see.",
          "A blank screen usually means the website blocks being shown inside other sites. The “Blank screen?” button explains why.",
          "Every device and menu group comes from the admin panel: changes you save there appear the next time the tester loads.",
        ],
      },
    ],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    path: "/admin",
    summary: "A quick health check: what's live on the tester, account security, and recent activity.",
    blocks: [
      {
        heading: "What the dashboard shows",
        image: "dashboard.svg",
        caption: "The dashboard",
        steps: [
          "Screen views live on the tester: how many devices visitors can see, by type.",
          "Menu groups: how many tabs the tester shows. Select “Manage menu groups” to change them.",
          "Accounts with 2FA: how many accounts use two-factor sign-in, and how many still have a temporary password.",
          "Failed sign-ins in the last 24 hours. A sudden rise can mean someone is guessing passwords.",
          "Recent activity: the latest actions in plain language, with when they happened. Select “Open audit log” for the full history.",
        ],
        tips: ["A yellow banner appears when two-factor sign-in is optional. Admins can require it in Settings → Security."],
      },
    ],
  },
  {
    key: "screen-views",
    title: "Screen views (devices)",
    path: "/admin/screen-views",
    summary: "Every device the tester can show: its name, size and frame. Add, edit, hide or remove devices here.",
    blocks: [
      {
        heading: "Find and filter devices",
        image: "screen-views.svg",
        caption: "The screen views list with search, filters and bulk actions",
        steps: [
          "Search by name, brand or width, or filter by type (Mobile, Tablet, Desktop, TV), brand or status.",
          "The On tester switch shows or hides a device for visitors immediately, without deleting it.",
          "Tick several rows to show, hide or delete them together using the bar that appears above the table.",
        ],
      },
      {
        heading: "Add or edit a device",
        image: "screen-view-edit.svg",
        caption: "Editing a screen view, with a live preview of the frame",
        steps: [
          "Select Add screen view, or the pencil icon on a row.",
          "Enter the name, brand and type.",
          "Enter the width and height in CSS pixels (the size the device's browser reports, not the physical screen resolution). The ⇄ button swaps them.",
          "Choose a frame style (for example Dynamic Island, notch or browser window). The preview updates as you type.",
          "Pick the menu groups it should appear in, then select Save.",
        ],
        tips: [
          "Not sure of a device's CSS size? Search the web for “<device name> viewport size”.",
          "To retire a device, turn it off instead of deleting it. You can turn it back on later.",
          "Duplicate (the copy icon) is the quickest way to add a similar model.",
        ],
      },
    ],
  },
  {
    key: "menu-groups",
    title: "Menu groups",
    path: "/admin/families",
    summary: "The tabs across the top of the tester, such as Popular or Tablets, and which devices each one shows.",
    blocks: [
      {
        heading: "Change the menu order",
        image: "menu-groups.svg",
        caption: "Drag a row by its grip (⋮⋮) to move it",
        steps: [
          "Hold the grip at the left of a row and drag it up or down. A blue line shows where it will land.",
          "Let go. The new order saves straight away and the tester uses it on its next load.",
          "Without a mouse: focus the grip with Tab and press the ↑ and ↓ keys.",
        ],
        tips: [
          "“Make first” chooses which tab the tester opens on.",
          "The On tester switch hides a whole group without deleting it.",
        ],
      },
      {
        heading: "Choose and order the devices in a group",
        image: "menu-group-edit.svg",
        caption: "Editing a menu group: add devices, drag to order them",
        steps: [
          "Select the pencil icon on a group (or Add group).",
          "Enter the tab name. The ID is used in share links and is created from the name if left empty.",
          "Use “Add a screen view…” to add devices. Drag them by their grip to set the order visitors see.",
          "Remove a device from this group with ×. The device itself is not deleted.",
          "Select Save.",
        ],
      },
    ],
  },
  {
    key: "users",
    title: "Users",
    path: "/admin/users",
    summary: "Everyone who can sign in to the admin panel: add people, switch accounts on or off, and help with passwords.",
    blocks: [
      {
        heading: "The users list",
        image: "users.svg",
        caption: "The users list with the status switch",
        steps: [
          "Each row shows the person's name, username, email, role, two-factor status and last sign-in.",
          "The Status switch turns an account on or off. Turning it off blocks sign-in and signs that person out at once.",
          "“Temporary password” under the switch means they haven't chosen their own password yet.",
        ],
        tips: ["Admins can't change Developer accounts; those rows show “Developer only”. You can't disable or delete your own account."],
      },
      {
        heading: "Add a user",
        steps: [
          "Select Add user.",
          "Enter a username (letters, numbers, - and _), and optionally a display name and email.",
          "Choose the role and select “Create and show password”.",
          "Copy the temporary password shown and give it to the person privately. It is shown only once.",
        ],
      },
      {
        heading: "Edit a user, reset a password or two-factor",
        image: "user-edit.svg",
        caption: "The edit popup with the password and two-factor buttons",
        steps: [
          "Select Edit on the person's row.",
          "Change their display name, email or role, then select Save.",
          "Reset password… opens the password options (below).",
          "Remove two-factor turns off their authenticator, for example if they lost their phone. They set it up again at their next sign-in if it's required.",
        ],
        tips: ["Both resets sign the person out on every device straight away."],
      },
      {
        heading: "Reset someone's password",
        image: "reset-password.svg",
        caption: "Resetting a password",
        steps: [
          "Choose “Generate a temporary password” and select Generate password.",
          "Copy the password shown and give it to them privately. They must replace it when they sign in.",
        ],
      },
      {
        heading: "Type a password for someone (Developers)",
        perm: "users.set_password",
        steps: [
          "In Reset password, choose “Type a new password”.",
          "Enter and repeat the password. It must follow the password rules.",
          "Leave “Ask them to choose their own password at next sign-in” ticked unless they should keep it.",
        ],
      },
      {
        heading: "Change a username (Developers)",
        perm: "users.change_username",
        text: "In the edit popup, change the Username field and save. Tell the person: their old username stops working immediately. They can still sign in with their email.",
      },
    ],
  },
  {
    key: "audit-log",
    title: "Audit log",
    path: "/admin/audit-logs",
    summary: "A permanent record of every sign-in, change, export and blocked request, and whether it worked.",
    blocks: [
      {
        heading: "Read and filter the log",
        image: "audit-log.svg",
        caption: "The audit log",
        steps: [
          "Each row says who did what, in plain language, with Success or Failed and the HTTP status code (for example 200 OK, 422 invalid input, 403 not allowed).",
          "Search by user, target or IP address, or filter by status, activity type and date range.",
          "Select the + at the start of a row to see the details: the technical action code, the request, IP address, browser and exactly what changed.",
        ],
      },
      {
        heading: "Export",
        image: "audit-details.svg",
        caption: "Row details and the export bar",
        steps: [
          "Tick rows, then select Export JSON or Export CSV in the bar that appears.",
          "Or use “Export all matching” to export everything that matches your current filters.",
          "Every export is itself recorded in the log.",
        ],
        tips: ["CSV files open in Excel. JSON keeps every detail and suits other systems."],
      },
      {
        heading: "Check that nothing was tampered with",
        text: "Select Check integrity. Each row carries a fingerprint linked to the one before it, so any row edited or removed outside the app is detected and its number shown. Rows can never be edited or deleted from the admin panel.",
      },
    ],
  },
  {
    key: "system-log",
    title: "System log",
    path: "/admin/system-logs",
    summary: "Technical errors and notable events from the server, for troubleshooting.",
    blocks: [
      {
        heading: "Using the system log (Developers)",
        perm: "systemlogs.view",
        steps: [
          "Filter by level (error, warning, info…) or date, or search the message.",
          "Expand a row to see the full message, the page that triggered it and technical details.",
          "How long entries are kept and which levels are stored is set in Settings → Log.",
        ],
      },
    ],
  },
  {
    key: "settings-general",
    title: "Settings: General",
    path: "/admin/settings/general",
    summary: "The site name and how the tester opens for new visitors.",
    blocks: [
      {
        heading: "General settings",
        image: "settings-general.svg",
        caption: "Settings → General",
        steps: [
          "Site name: shown in the tester's header and browser tab.",
          "Tester opens in: Scroll or Grid. Visitors can still switch; their own choice is remembered on their device.",
          "Device size: True scale or Fill height.",
          "Select Save. The tester uses the new values on its next load.",
        ],
        tips: ["Settings has four tabs, each with its own address: General, Security, Log (Developers only) and Extra."],
      },
    ],
  },
  {
    key: "settings-security",
    title: "Settings: Security",
    path: "/admin/settings/security",
    summary: "Rules that protect every account: two-factor sign-in, session length, passwords and lockout.",
    blocks: [
      {
        heading: "Security settings",
        image: "settings-security.svg",
        caption: "Settings → Security",
        steps: [
          "Require two-factor sign-in for everyone: accounts without it are asked to set it up at their next sign-in. Turning this off asks for your own authenticator code.",
          "Sign out after inactivity: minutes without activity before someone is signed out (5 to 720).",
          "Minimum password length: 8 to 64 characters. Upper and lower case, a number and a symbol are always required.",
          "Failed sign-ins before lockout, and how long the lockout lasts.",
          "Select Save.",
        ],
        tips: ["Recommended: require two-factor sign-in, and keep the inactivity timeout at 30 minutes or less."],
      },
    ],
  },
  {
    key: "settings-log",
    title: "Settings: Log",
    path: "/admin/settings/log",
    summary: "What the system log keeps and for how long.",
    blocks: [
      {
        heading: "Log settings (Developers)",
        perm: "systemlogs.view",
        steps: [
          "Lowest level to keep: entries below it are not stored. Info is recommended.",
          "Keep entries for (days): older entries are deleted daily; 0 keeps them forever.",
          "Delete old entries now: removes entries older than the limit straight away.",
        ],
        tips: ["The audit log is never deleted. Daily clean-up needs the Laravel scheduler on the server."],
      },
    ],
  },
  {
    key: "settings-extra",
    title: "Settings: Extra",
    path: "/admin/settings/extra",
    summary: "An announcement banner on the tester, and a contact address for visitors who need help.",
    blocks: [
      {
        heading: "Extra settings",
        image: "settings-extra.svg",
        caption: "Settings → Extra",
        steps: [
          "Turn on Announcement banner and enter the message, for example planned maintenance. It appears across the top of the tester.",
          "Help contact email: shown in the tester's “Blank screen?” help. Leave it empty to hide it.",
          "Select Save. Turn the banner off again when it's no longer needed.",
        ],
      },
    ],
  },
  {
    key: "profile",
    title: "My profile",
    path: "/admin/profile",
    summary: "Your own details, password and two-factor sign-in.",
    blocks: [
      {
        heading: "Your details and password",
        image: "profile.svg",
        caption: "My profile",
        steps: [
          "Open it from your name at the top right, then My profile.",
          "Update your display name or email and select Save details.",
          "To change your password, enter your current password and the new one twice. Your other sessions are signed out.",
        ],
      },
      {
        heading: "Two-factor sign-in",
        steps: [
          "Select Set up, then Set up two-factor sign-in, and scan the QR code with an authenticator app.",
          "Enter the 6-digit code to turn it on, then save the 8 recovery codes (copy or download them). Each works once.",
          "New recovery codes and Turn off both ask for your password first.",
        ],
        tips: ["Keep recovery codes somewhere other than your phone, such as a password manager.", "Turn off is unavailable while two-factor sign-in is required for everyone."],
      },
      {
        heading: "Change your username (Developers)",
        perm: "users.change_username",
        text: "Developers see a Username field here. After saving, sign in with the new username or your email.",
      },
    ],
  },
];

/** Topic for an admin path, matching the longest route prefix (so /admin/settings/log finds Settings: Log). */
export function helpForPath(path: string): HelpTopic | undefined {
  return HELP.filter((t) => t.path && (path === t.path || (t.path !== "/admin" && path.startsWith(t.path))))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0]
    ?? (path === "/admin" ? HELP.find((t) => t.key === "dashboard") : undefined);
}
