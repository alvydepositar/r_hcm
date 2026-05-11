$(function () {
  "use strict";

  const nav = document.getElementById("sidebarnav");
  if (!nav) {
    return;
  }

  function normalizePathname(pathname) {
    return pathname.replace(/\/+$/, "") || "/";
  }

  function getToggleSubmenu(link) {
    if (!link || !link.classList.contains("has-arrow")) {
      return null;
    }
    const submenu = link.nextElementSibling;
    if (!submenu || submenu.tagName !== "UL") {
      return null;
    }
    return submenu;
  }

  function collapseDescendants(rootList) {
    rootList.querySelectorAll("a.has-arrow").forEach(function (childToggle) {
      const childSubmenu = getToggleSubmenu(childToggle);
      if (!childSubmenu) {
        return;
      }
      childToggle.classList.remove("active");
      childToggle.setAttribute("aria-expanded", "false");
      childSubmenu.classList.remove("in");
      childSubmenu.setAttribute("aria-expanded", "false");
      const childItem = childToggle.closest(".sidebar-item");
      if (childItem) {
        childItem.classList.remove("selected");
      }
    });
  }

  function setToggleExpanded(toggleLink, isExpanded) {
    const submenu = getToggleSubmenu(toggleLink);
    if (!submenu) {
      return;
    }

    toggleLink.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    toggleLink.classList.toggle("active", isExpanded);

    submenu.classList.toggle("in", isExpanded);
    submenu.setAttribute("aria-expanded", isExpanded ? "true" : "false");

    const parentItem = toggleLink.closest(".sidebar-item");
    if (parentItem) {
      parentItem.classList.toggle("selected", isExpanded);
    }

    if (!isExpanded) {
      collapseDescendants(submenu);
    }
  }

  function closeSiblingMenus(toggleLink) {
    const parentItem = toggleLink.closest(".sidebar-item");
    const parentList = parentItem ? parentItem.parentElement : null;
    if (!parentList) {
      return;
    }

    Array.from(parentList.children).forEach(function (sibling) {
      if (sibling === parentItem || !sibling.classList.contains("sidebar-item")) {
        return;
      }

      const siblingToggle = Array.from(sibling.children).find(function (child) {
        return child.matches && child.matches("a.has-arrow");
      });

      if (siblingToggle) {
        setToggleExpanded(siblingToggle, false);
      }
    });
  }

  function scoreNavLink(link) {
    const href = link.getAttribute("href");
    if (!href || href === "#" || href.indexOf("javascript:") === 0) {
      return -1;
    }

    let linkUrl;
    let currentUrl;

    try {
      linkUrl = new URL(link.href, window.location.origin);
      currentUrl = new URL(window.location.href);
    } catch (error) {
      return -1;
    }

    if (
      normalizePathname(linkUrl.pathname) !== normalizePathname(currentUrl.pathname)
    ) {
      return -1;
    }

    let score = 10;

    if (linkUrl.search === currentUrl.search) {
      score += 6;
    } else if (linkUrl.search && currentUrl.search) {
      score -= 2;
    } else if (!linkUrl.search && currentUrl.search) {
      score += 2;
    } else if (linkUrl.search && !currentUrl.search) {
      score -= 1;
    }

    if (linkUrl.hash && linkUrl.hash === currentUrl.hash) {
      score += 3;
    } else if (linkUrl.hash && !currentUrl.hash) {
      score -= 1;
    }

    return score + link.href.length / 1000;
  }

  function markBestMatchingLinkActive() {
    const links = Array.from(nav.querySelectorAll("a.sidebar-link"));
    let bestLink = null;
    let bestScore = -1;

    links.forEach(function (link) {
      const score = scoreNavLink(link);
      if (score > bestScore) {
        bestScore = score;
        bestLink = link;
      }
    });

    if (bestLink && bestScore >= 0) {
      bestLink.classList.add("active");
      return bestLink;
    }

    return null;
  }

  function expandParentsForActiveLink(activeLink) {
    let currentSubmenu = activeLink ? activeLink.closest("ul.collapse") : null;

    while (currentSubmenu) {
      currentSubmenu.classList.add("in");
      currentSubmenu.setAttribute("aria-expanded", "true");

      const parentItem = currentSubmenu.closest(".sidebar-item");
      if (!parentItem) {
        break;
      }

      parentItem.classList.add("selected");

      const parentToggle = Array.from(parentItem.children).find(function (child) {
        return child.matches && child.matches("a.has-arrow");
      });

      if (parentToggle) {
        parentToggle.classList.add("active");
        parentToggle.setAttribute("aria-expanded", "true");
      }

      currentSubmenu = parentItem.parentElement.closest("ul.collapse");
    }
  }

  nav.querySelectorAll("a.has-arrow").forEach(function (toggleLink) {
    const submenu = getToggleSubmenu(toggleLink);
    if (!submenu) {
      return;
    }

    const isOpen =
      submenu.classList.contains("in") ||
      toggleLink.getAttribute("aria-expanded") === "true";

    toggleLink.setAttribute("aria-expanded", isOpen ? "true" : "false");
    submenu.setAttribute("aria-expanded", isOpen ? "true" : "false");
    submenu.classList.toggle("in", isOpen);
  });

  const activeLink = markBestMatchingLinkActive();
  expandParentsForActiveLink(activeLink);

  nav.querySelectorAll("a.has-arrow").forEach(function (toggleLink) {
    toggleLink.addEventListener("click", function (event) {
      event.preventDefault();

      const submenu = getToggleSubmenu(this);
      if (!submenu) {
        return;
      }

      const willExpand = !submenu.classList.contains("in");
      if (willExpand) {
        closeSiblingMenus(this);
      }

      setToggleExpanded(this, willExpand);
    });
  });
});
