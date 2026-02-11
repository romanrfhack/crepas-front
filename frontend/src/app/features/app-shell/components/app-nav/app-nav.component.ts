import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem, NavSection } from '../../navigation/app-nav.config';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './app-nav.component.html',
  styleUrl: './app-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppNavComponent {
  readonly navItems = input.required<NavSection[]>();
  readonly userRoles = input<string[]>([]);

  private readonly collapsedSections = signal<Record<string, boolean>>({});
  readonly visibleSections = computed(() =>
    this.navItems()
      .filter((section) => this.isVisibleForRoles(section.roles))
      .map((section) => ({
        ...section,
        children: section.children
          .map((item) => this.filterVisibleNavItem(item))
          .filter((item): item is NavItem => item !== null),
      }))
      .filter((section) => section.children.length > 0),
  );

  toggleSection(sectionLabel: string) {
    this.collapsedSections.update((state) => ({
      ...state,
      [sectionLabel]: !this.isSectionExpanded(sectionLabel),
    }));
  }

  isSectionExpanded(sectionLabel: string) {
    return !this.collapsedSections()[sectionLabel];
  }

  private filterVisibleNavItem(item: NavItem): NavItem | null {
    if (!this.isVisibleForRoles(item.roles)) {
      return null;
    }

    if (!item.children?.length) {
      return item;
    }

    const visibleChildren = item.children
      .map((childItem) => this.filterVisibleNavItem(childItem))
      .filter((childItem): childItem is NavItem => childItem !== null);

    if (!visibleChildren.length) {
      return null;
    }

    return {
      ...item,
      children: visibleChildren,
    };
  }

  private isVisibleForRoles(requiredRoles?: string[]) {
    if (!requiredRoles?.length) {
      return true;
    }

    const normalizedUserRoles = this.userRoles().map((role) => role.toLowerCase());
    return requiredRoles.some((role) => normalizedUserRoles.includes(role.toLowerCase()));
  }
}
