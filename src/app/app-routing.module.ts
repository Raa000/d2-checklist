import { Injectable, NgModule } from '@angular/core';
import { CanActivate, RouterModule } from '@angular/router';
import { BungieService } from '@app/service/bungie.service';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AboutComponent } from './about';
import { AuthComponent } from './auth';
import { BungieSearchComponent } from './bungie-search';
import { ClanComponent } from './clan';
import { ClanSearchComponent } from './clan-search';
import { ClanInfoComponent } from './clan/clan-info/clan-info.component';
import { ClanLifetimeComponent } from './clan/clan-lifetime/clan-lifetime.component';
import { ClanMembersComponent } from './clan/clan-members/clan-members.component';
import { ClanMilestonesComponent } from './clan/clan-milestones/clan-milestones.component';
import { ClanSealsComponent } from './clan/clan-triumphs/clan-seals/clan-seals.component';
import { ClanTriumphsComponent } from './clan/clan-triumphs/clan-triumphs.component';
import { FriendsComponent } from './friends';
import { GearComponent } from './gear';
import { HistoryComponent } from './history';
import { HomeComponent } from './home';
import { PGCRComponent } from './pgcr';
import { PlayerComponent } from './player';
import { CharsComponent } from './player/chars/chars.component';
import { ChecklistComponent } from './player/checklist/checklist.component';
import { CollectionBadgeComponent } from './player/collections/collection-badge/collection-badge.component';
import { CollectionBadgesComponent } from './player/collections/collection-badges/collection-badges.component';
import { CollectionSearchComponent } from './player/collections/collection-search/collection-search.component';
import { CollectionTreeComponent } from './player/collections/collection-tree/collection-tree.component';
import { CollectionsComponent } from './player/collections/collections.component';
import { MilestonesComponent } from './player/milestones/milestones.component';
import { ProgressComponent } from './player/progress/progress.component';
import { BountiesComponent } from './player/pursuits/bounties/bounties.component';
import { PursuitsComponent } from './player/pursuits/pursuits.component';
import { QuestsComponent } from './player/pursuits/quests/quests.component';
import { TriumphClosestComponent } from './player/triumphs/triumph-closest/triumph-closest.component';
import { TriumphMotComponent } from './player/triumphs/triumph-mot/triumph-mot.component';
import { TriumphSealsComponent } from './player/triumphs/triumph-seals/triumph-seals.component';
import { TriumphSearchComponent } from './player/triumphs/triumph-search/triumph-search.component';
import { TriumphSeasonsComponent } from './player/triumphs/triumph-seasons/triumph-seasons.component';
import { TriumphTrackedComponent } from './player/triumphs/triumph-tracked/triumph-tracked.component';
import { TriumphTreeComponent } from './player/triumphs/triumph-tree/triumph-tree.component';
import { TriumphsComponent } from './player/triumphs/triumphs.component';
import { RecentPlayersComponent } from './recent-players';
import { ResourcesComponent } from './resources';
import { DestinyCacheService } from './service/destiny-cache.service';
import { SettingsComponent } from './settings';
import { ClanTriumphSearchComponent } from './clan/clan-triumphs/clan-triumph-search/clan-triumph-search.component';
import { ClanTriumphTrackedComponent } from './clan/clan-triumphs/clan-triumph-tracked/clan-triumph-tracked.component';
import { ClanSettingsComponent } from './clan/clan-settings/clan-settings.component';


@Injectable()
export class AuthGuard implements CanActivate {
  public loader$ = new Subject<boolean>();

  constructor(private destinyCacheService: DestinyCacheService, private bungieService: BungieService) {
  }

  canActivate(): Observable<boolean> {
    return this.destinyCacheService.ready.asObservable().pipe(filter(x => x === true));
  }
}

@NgModule({
  imports: [RouterModule.forRoot(
    [{
      path: '',
      redirectTo: 'home',
      pathMatch: 'full'
    }
      , {
      path: 'home',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: HomeComponent
    },
    {
      path: 'auth',
      pathMatch: 'full',
      component: AuthComponent
    },

    {
      path: 'settings',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: SettingsComponent
    }, {
      path: 'about',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: AboutComponent
    }, {
      path: 'friends',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: FriendsComponent
    }, {
      path: 'gear',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: GearComponent
    }, {
      path: 'search',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: BungieSearchComponent
    }, {
      path: 'searchClans',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: ClanSearchComponent
    }, {
      path: 'search/:name',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: BungieSearchComponent
    }, {
      path: 'clan/:id',
      pathMatch: 'prefix',
      canActivate: [AuthGuard],
      component: ClanComponent,
      children: [
        {
          path: '',
          redirectTo: 'members',
          pathMatch: 'full'
        },
        {
          path: 'members',
          component: ClanMembersComponent,
        },
        {
          path: 'info',
          component: ClanInfoComponent,
        },
        {
          path: 'milestones',
          component: ClanMilestonesComponent,
        },

        {
          path: 'lifetime',
          component: ClanLifetimeComponent,
        },
        {
          path: 'settings',
          component: ClanSettingsComponent,
        },
        {
          path: 'triumphs',
          pathMatch: 'prefix',
          component: ClanTriumphsComponent,
          children: [
            {
              path: '',
              redirectTo: 'seals',
              pathMatch: 'full'
            },
            {
              path: 'seals',
              component: ClanSealsComponent
            }, {
              path: 'search',
              component: ClanTriumphSearchComponent
            }, {
              path: 'tracked',
              component: ClanTriumphTrackedComponent
            }
          ]
        }
      ]
    },
    {
      path: 'pgcr/:instanceId',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: PGCRComponent
    },
    {
      path: 'vendors/:characterId/:tab',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: ResourcesComponent
    },
    {
      path: 'vendors/:characterId',
      pathMatch: 'full',
      redirectTo: 'vendors/:characterId/Bounties'
    },
    {
      path: 'vendors',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: ResourcesComponent
    },
    {
      path: 'history/:platform/:memberId/:characterId',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: HistoryComponent
    },
    {
      path: 'recent-players/:platform/:memberId/:characterId',
      pathMatch: 'full',
      canActivate: [AuthGuard],
      component: RecentPlayersComponent
    },
    {
      path: ':platform/:gt',
      pathMatch: 'prefix',
      canActivate: [AuthGuard],
      component: PlayerComponent,
      children: [
        {
          path: '',
          redirectTo: 'milestones',
          pathMatch: 'full'
        },
        {
          path: 'milestones',
          component: MilestonesComponent,
        },
        {
          path: 'pursuits',
          component: PursuitsComponent,
          children: [
            {
              path: '',
              redirectTo: 'bounties',
              pathMatch: 'full'
            },
            {
              path: 'bounties',
              component: BountiesComponent,
            },
            {
              path: 'quests',
              component: QuestsComponent,
            }
          ]
        },
        {
          path: 'checklist',
          component: ChecklistComponent,
        },
        {
          path: 'progress',
          component: ProgressComponent,
        },
        {
          path: 'triumphs',
          component: TriumphsComponent,
          children: [
            // {
            //   path: '',
            //   redirectTo: 'tree',
            //   pathMatch: 'full'
            // },
            {
              path: '',
              redirectTo: 'mot',
              pathMatch: 'full'
            },
            {
              path: 'mot',
              component: TriumphMotComponent,
            },
            {
              path: 'tree/:node',
              component: TriumphTreeComponent,
            },
            {
              path: 'tree',
              component: TriumphTreeComponent,
            },
            {
              path: 'seasons',
              component: TriumphSeasonsComponent,
            },
            {
              path: 'seals',
              component: TriumphSealsComponent,
            },
            {
              path: 'closest',
              component: TriumphClosestComponent,
            },
            {
              path: 'search',
              component: TriumphSearchComponent,
            },
            {
              path: 'tracked',
              component: TriumphTrackedComponent,
            }
          ]
        },
        {
          path: 'collections',
          component: CollectionsComponent,
          children: [
            {
              path: '',
              redirectTo: 'tree',
              pathMatch: 'full'
            },
            {
              path: 'tree/:node',
              component: CollectionTreeComponent,
            },
            {
              path: 'tree',
              component: CollectionTreeComponent,
            },
            {
              path: 'search',
              component: CollectionSearchComponent,
            },
            {
              path: 'badges',
              component: CollectionBadgesComponent,
            },
            {
              path: 'badges/:node',
              component: CollectionBadgeComponent,
            },
          ]
        },
        {
          path: 'chars',
          component: CharsComponent,
        },
      ]
    },
    {
      path: '**',
      redirectTo: 'home'
    }
    ], { useHash: false })],
  exports: [RouterModule],
  providers: [AuthGuard]
})
export class AppRoutingModule { }
