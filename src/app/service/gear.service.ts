import { Injectable } from '@angular/core';
import { getHttpErrorMsg, sleep } from '@app/shared/utilities';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { Bucket, BucketService } from './bucket.service';
import { BungieService } from './bungie.service';
import { ManifestInventoryItem, SimpleInventoryItem } from './destiny-cache.service';
import { MarkService } from './mark.service';
import { BUCKET_ID_SHARED, BUCKET_ID_VAULT, Character, ClassAllowed, InventoryItem, InventoryPlug, InventorySocket, ItemType, Player, SelectedUser, Target, WeaponShapeLevelObjective } from './model';
import { NotificationService } from './notification.service';
import { PandaGodrollsService } from './panda-godrolls.service';
import { PreferredStatService } from './preferred-stat.service';
import { SignedOnUserService } from './signed-on-user.service';

interface VaultStatus {
    isFull: boolean;
}

interface ClearInvChecker {
    (item: InventoryItem): boolean;
}


export interface Operation {
    item: SimpleInventoryItem;
    action: string;
    error?: boolean;
}

function isJunk(i: InventoryItem): boolean {
    return i.mark == 'junk';
}


function isKeepUpgradeUntagged(i: InventoryItem): boolean {
    return i.mark == 'keep' || i.mark == 'upgrade' || i.mark == null;
}

function isNeverTrue(i: InventoryItem): boolean {
    return false;
}

function isGrind(i: InventoryItem): boolean {
    return i.deepsight || (i.crafted && i.craftProgress?.level < 20);
}

@Injectable()
export class GearService {

    public loading: BehaviorSubject<boolean> = new BehaviorSubject(false);
    public _operatingOn$: BehaviorSubject<Operation> = new BehaviorSubject(null);

    public operatingOn$: Observable<Operation>;

    public static sortGear(sortBy: string, sortDesc: boolean, tempGear: InventoryItem[]) {
        if (sortBy.startsWith('masterwork.') || sortBy == 'mods' || sortBy.startsWith('stat.')) {
            tempGear.sort((a: InventoryItem, b: InventoryItem): number => {
                let aV: any = '';
                let bV: any = '';
                if (sortBy.startsWith('stat.')) {
                    const hash = +sortBy.substring('stat.'.length);
                    for (const s of a.stats) {
                        if (s.hash == hash) {
                            aV = s.value;
                        }
                    }
                    for (const s of b.stats) {
                        if (s.hash == hash) {
                            bV = s.value;
                        }
                    }
                } else if (sortBy == 'masterwork.tier') {
                    aV = a.masterwork != null ? a.masterwork.tier : -1;
                    bV = b.masterwork != null ? b.masterwork.tier : -1;
                } else if (sortBy == 'masterwork.name') {
                    aV = a.masterwork != null ? a.masterwork.name : '';
                    bV = b.masterwork != null ? b.masterwork.name : '';
                } else if (sortBy == 'mods') {
                    aV = a[sortBy] != null && a[sortBy].length > 0 ? a[sortBy][0].name : '';
                    bV = b[sortBy] != null && b[sortBy].length > 0 ? b[sortBy][0].name : '';
                }
                if (aV < bV) {
                    return sortDesc ? 1 : -1;
                } else if (aV > bV) {
                    return sortDesc ? -1 : 1;
                } else {
                    if (sortBy != 'mods') {
                        aV = a[sortBy] != null ? a[sortBy].name : '';
                        bV = b[sortBy] != null ? b[sortBy].name : '';
                        if (aV < bV) {
                            return sortDesc ? 1 : -1;
                        } else if (aV > bV) {
                            return sortDesc ? -1 : 1;
                        }
                    }
                    return 0;
                }
            });
        } else if (sortBy.startsWith('plug.')) {
            const suffix = sortBy.substring('plug.'.length);
            const as = suffix.split('.');
            const socket = +as[0];
            const plug = +as[1];


            tempGear.sort((a: InventoryItem, b: InventoryItem): number => {
                try {
                    let aV = '';
                    let bV = '';
                    if (a.sockets && a.sockets.length > socket) {
                        if (a.sockets[socket].plugs && a.sockets[socket].plugs.length > plug) {
                            aV = a.sockets[socket].plugs[plug].name;
                        }
                    }
                    if (b.sockets && b.sockets.length > socket) {
                        if (b.sockets[socket].plugs && b.sockets[socket].plugs.length > plug) {
                            bV = b.sockets[socket].plugs[plug].name;
                        }
                    }
                    if (aV < bV) {
                        return sortDesc ? -1 : 1;
                    } else if (aV > bV) {
                        return sortDesc ? 1 : -1;
                    } else {
                        return 0;
                    }
                } catch (e) {
                    console.log('Error sorting: ' + e);
                    return 0;
                }
            });
        } else if (sortBy.startsWith('progress.')) {
            const prog = sortBy.substring('progress.'.length);
            tempGear.sort((a: any, b: any): number => {
                try {
                    const aObj = a[prog] as WeaponShapeLevelObjective;
                    const bObj = b[prog] as WeaponShapeLevelObjective;

                    // regardless of everything else, we want null progress to go last
                    if (aObj == null && bObj == null) {
                        return 0;
                    }
                    if (aObj == null) {
                        return 1;
                    }
                    if (bObj == null) {
                        return -1;
                    }
                    let aV = aObj.progress;
                    if (aObj.level) {
                        aV = 100*aObj.level + aObj.percent;
                    }
                    let bV = bObj.progress;
                    if (bObj.level) {
                        bV = 100 * bObj.level + bObj.percent;
                    }
                    if (aV < bV) {
                        return sortDesc ? 1 : -1;
                    } else if (aV > bV) {
                        return sortDesc ? -1 : 1;
                    } else {
                        return 0;
                    }
                } catch (e) {
                    console.log('Error sorting: ' + e);
                    return 0;
                }
            });
        } else {
            tempGear.sort((a: any, b: any): number => {
                try {
                    const aV = a[sortBy] != null ? a[sortBy] : '';
                    const bV = b[sortBy] != null ? b[sortBy] : '';

                    if (aV < bV) {
                        return sortDesc ? 1 : -1;
                    } else if (aV > bV) {
                        return sortDesc ? -1 : 1;
                    } else {
                        return 0;
                    }
                } catch (e) {
                    console.log('Error sorting: ' + e);
                    return 0;
                }
            });
        }
    }

    public static filterDupes(tempGear: InventoryItem[]) {
        const gearHashes: { [key: string]: boolean; } = {};
        const returnMe: InventoryItem[] = [];

        for (const i of tempGear) {
            if (!gearHashes[i.hash]) {
                gearHashes[i.hash] = true;
                returnMe.push(i);
            } else if (i.type == ItemType.ExchangeMaterial) {
                returnMe.push(i);
            }
        }
        return returnMe;
    }

    constructor(private bungieService: BungieService,
        public markService: MarkService,
        private signedOnUserService: SignedOnUserService,
        private notificationService: NotificationService,
        private bucketService: BucketService,
        private pandaService: PandaGodrollsService,
        private preferredStatService: PreferredStatService) {
        this.operatingOn$ = this._operatingOn$.asObservable().pipe(
            tap((o) => {
                if (o) {
                    console.log(`${o.item?.displayProperties?.name}: ${o.action} `);
                } 
            }),
            debounceTime(50));
    }

    public async loadGear(selectedUser: SelectedUser, lastPlayer: Player): Promise<Player> {
        try {
            this.loading.next(true);
            const player = await this.bungieService.getChars(selectedUser.userInfo.membershipType,
                selectedUser.userInfo.membershipId, ['Profiles', 'Characters', 'ProfileCurrencies',
                'CharacterEquipment', 'CharacterInventories', 'ItemObjectives',
                'ItemInstances', 'ItemPerks', 'ItemStats', 'ItemSockets', 'ItemPlugStates',
                'ItemCommonData', 'ProfileInventories', 'ItemReusablePlugs', 'ItemPlugObjectives', 'StringVariables', 'PresentationNodes', 'Records'], false, true);
            if (lastPlayer) {
                if (lastPlayer.responseMintedTimestamp>player.responseMintedTimestamp) {
                    console.log(`STALE RESPONSE`);
                    this.notificationService.info('Stale response from Bungie. Please try again.');
                    return null;
                } else if (lastPlayer.responseMintedTimestamp==player.responseMintedTimestamp) {
                    console.log(`NOTHING NEW HERE`);
                    this.notificationService.info('Bungie shows no profile changes. Please try again.');
                    return null;

                }
            }
            // Craftables ?
            // update gear counts on title bar
            this.signedOnUserService.gearMetadata$.next(player.gearMetaData);
            this.signedOnUserService.currencies$.next(player.currencies);
            const gearById: { [key: string]: InventoryItem[]; } = {};
            for (const g of player.gear) {
                this.canEquip(g);
                if (gearById[g.hash] == null) {
                    gearById[g.hash] = [];
                }
                gearById[g.hash].push(g);
                // handle exotic catalysts and deepsight patterns
                if (g.deepsight) {
                    const patternTriumph = player.patternTriumphs.find(x => x.name == g.name);
                    if (patternTriumph) {
                        g.patternTriumph = patternTriumph;
                        if (patternTriumph.percent<100) {
                            g.searchText += ' is:needrecipe ';
                        }
                    }
                }
                if (g.tier == 'Exotic') {
                    const exoticWeaponTriumph = player.exoticCatalystTriumphs.find(x => x.name.startsWith(g.name));
                    if (exoticWeaponTriumph) {
                        // console.log(`Found catalyst triumph for ${g.name} -> ${exoticWeaponTriumph.name}`);
                        g.exoticCatalystTriumph = exoticWeaponTriumph;
                    }

                }
            }
            this.bucketService.init(player.characters, player.vault, player.shared, player.gear);
            this.markService.processItems(player.gear);
            for (const key of Object.keys(gearById)) {
                const items = gearById[key];
                for (const item of items) {
                    item.copies = items.length;
                    let copies = null;
                    if (item.type === ItemType.Armor) {
                        copies = this.findSimilarArmor(item, player, false);
                        item.dupesByArmorSlot = copies.length;
                    }
                    if (item.type === ItemType.Weapon) {
                        copies = this.findSimilarWeaponsByFrame(item, player, true, true);
                        item.dupesByFrameSlotAndEnergy = copies.length;
                    }
                    if (copies) {
                        let taggedToKeep = 0;
                        for (const i of copies) {
                            if (i.mark == 'upgrade' || i.mark == 'keep' || i.mark == 'archive') {
                                taggedToKeep++;
                            }
                        }
                        item.dupesTaggedToKeep = taggedToKeep;
                        if (taggedToKeep > 1) {
                            item.searchText += ' is:extratagged ';
                        }
                    }
                }
            }
            this.pandaService.processItems(player.gear);
            this.preferredStatService.processGear(player);
            return player;
        } finally {
            this.loading.next(false);
        }
    }


    public canEquip(itm: InventoryItem) {
        // ignore itm.canEquip
        if (itm.equipped.getValue() == true || (itm.owner.getValue().id == BUCKET_ID_VAULT) || (itm.owner.getValue().id == BUCKET_ID_SHARED)) {
            itm.canReallyEquip = false;
        } else if (itm.classAllowed === ClassAllowed.Any || ClassAllowed[itm.classAllowed] === (itm.owner.getValue() as Character).className) {
            itm.canReallyEquip = true;
        } else {
            itm.canReallyEquip = false;
        }
    }

    public setExplicitOperatingOnMessage(msg: string) {
        this._operatingOn$.next({
            item: null,
            action: msg
        });
    }

    public clearOperatingOn() {
        this._operatingOn$.next(null);
    }

    private async clearVaultToCharacter(target: Character, player: Player, shouldIgnoreFunc: ClearInvChecker, vaultStatus: VaultStatus, progressTracker$: Subject<void>): Promise<number> {
        console.log('Clearing vault to ' + target.label);


        let moved = 0;
        for (const i of player.gear) {
            // it's in the vault
            if (i.owner && i.owner.getValue().id == BUCKET_ID_VAULT) {
                // weapons, or armor of the proper class are worth checking
                const worthChecking = i.type == ItemType.Weapon || (i.type == ItemType.Armor && target.classType == i.classAllowed);
                if (!worthChecking) {
                    continue;
                }
                // check if this item should still be ignored (for example, if it's Junk and we're doing shard mode, no point in removing that)
                if (shouldIgnoreFunc(i)) {
                    continue;
                }
                const targetBucket = this.bucketService.getBucket(target, i.inventoryBucket);
                if (targetBucket.items.length < i.inventoryBucket.itemCount) {

                    try {
                        let success;
                        if (i.postmaster === true) {
                            this._operatingOn$.next({
                                item: i.toSimpleInventoryItem(),
                                action: 'Pull from Postmaster'
                            });
                            const owner = i.owner.getValue();
                            success = await this.transfer(player, i, owner, vaultStatus, progressTracker$);
                            if (success) {
                                if (owner.id === target.characterId) {
                                    moved++;
                                    continue;
                                }
                            }
                        }
                        this._operatingOn$.next({
                            item: i.toSimpleInventoryItem(),
                            action: 'Move to ' + target.label
                        });
                        success = await this.transfer(player, i, target, vaultStatus, progressTracker$);
                        if (success) {
                            moved++;
                        }
                    } catch (e) {
                        console.log('Error on move: ' + e);
                    }
                }
            }
        }
        console.log(`Moved ${moved} items to ${target.label}`);
        return moved;

    }

    private async clearInvForMode(target: Target, player: Player, shouldIgnoreFunc: ClearInvChecker, itemType: ItemType, vaultStatus: VaultStatus, progressTracker$: Subject<void>): Promise<boolean> {
        console.log('Clearing inventory ahead of a mode.');
        this.notificationService.info('Clearing inventory ahead of time...');
        const buckets = this.bucketService.getBuckets(target);
        let totalErr = 0;
        let moved = 0;
        let err = 0;
        for (const bucket of buckets) {
            const items = bucket.items.slice();
            for (const i of items) {
                if (i.equipped.getValue() == false && !i.postmaster && !shouldIgnoreFunc(i)) {
                    if (itemType == null || i.type == itemType) {
                        if (i.type == ItemType.Weapon
                            || i.type == ItemType.Armor) {
                            if (i.postmaster === true) {
                                continue;
                            }
                            try {
                                this._operatingOn$.next({
                                    item: i.toSimpleInventoryItem(),
                                    action: 'Move to vault'
                                });
                                this.notificationService.info('Moving ' + i.name + ' to vault');
                                await this.transfer(player, i, player.vault, vaultStatus, progressTracker$);
                                if (vaultStatus.isFull) {
                                    this.notificationService.info('Vault is full. Ending clear prematurely');
                                    return false;
                                }
                                moved++;
                            } catch (e) {
                                this._operatingOn$.next({
                                    item: i.toSimpleInventoryItem(),
                                    action: 'Move to vault',
                                    error: true
                                });
                                console.log('Error moving ' + i.name + ' to vault: ' + e);
                                console.dir(e);
                                err++;
                                totalErr++;
                            }
                        }

                    }
                }
            }
        }
        if (err == 0) {
            this.notificationService.info('Removed ' + moved + ' items from ' + target.label + ' to vault');
        } else {
            this.notificationService.info('Removed ' + moved + ' items from ' + target.label + ' to vault. ' + err + ' items failed to move.');
        }
        console.log('Done clearing inventory. ' + totalErr + ' errors.');
        return true;
    }

    public async emptyVault(player: Player, progressTracker$: Subject<void>): Promise<number> {
        const notTarget = player.characters[0];

        let totalMoved = 0;
        for (const target of player.characters) {
            // skip current player
            if (target.characterId == notTarget.characterId) continue;

            const vaultStatus = { isFull: false };
            let charMoved = await this.clearVaultToCharacter(target, player, isJunk, vaultStatus, progressTracker$);
            totalMoved += charMoved;

        }
        this._operatingOn$.next(null);
        return totalMoved;
    }

    public async shardBlues(player: Player, progressTracker$: Subject<void>, itemType?: ItemType): Promise<string> {
        // tag all unmarked blues as junk
        let tagCount = 0;
        for (const item of player.gear) {
            if (item.tier == 'Rare' && item.mark == null && (item.type == ItemType.Weapon || item.type == ItemType.Armor)) {
                if (!item.isHighest) {
                    item.mark = 'junk';
                    this.markService.updateItem(item);
                    tagCount++;
                }
            }
        }
        this.notificationService.success(`Tagged ${tagCount} unmarked blues as junk. Starting blue shard mode.`);
        return this.shardMode(player, progressTracker$, itemType, true);
    }

    public async shardMode(player: Player, progressTracker$: Subject<void>, itemType?: ItemType, bluesOnly?: boolean): Promise<string> {
        const target = player.characters[0];
        let moved = 0;
        let tryCount = 0;
        let incrementalWork = 1;
        const vaultStatus = { isFull: false };
        let invClearedSuccessfully = false;
        while (!vaultStatus.isFull && tryCount < 3 && incrementalWork > 0) {
            tryCount++;
            incrementalWork = 0;
            if (tryCount > 1) {
                console.log(`Shard mode, pass # ${tryCount} - last run moved ${incrementalWork} items`);
            }
            invClearedSuccessfully = await this.clearInvForMode(target, player, isJunk, itemType, vaultStatus, progressTracker$);
            if (!vaultStatus.isFull) {
                console.log(`Shard mode cleared inv successfully.`);
            } else {
                console.log(`Shard mode encountered errors clearing inv.`);
            }
            for (const i of player.gear) {
                // might we move it?
                if (!bluesOnly || i.tier === 'Rare') {
                    // is this worth targeting?
                    if (isJunk(i) && i.owner.getValue().id != target.id && (itemType == null || i.type == itemType)) {
                        // if the vault is full and the item needs to move through the vault, forget about it
                        if (vaultStatus.isFull && i.owner.getValue().id != player.vault.id) {
                            continue;
                        }
                        const targetBucket = this.bucketService.getBucket(target, i.inventoryBucket);
                        if (targetBucket.items.length < i.inventoryBucket.itemCount) {
                            this._operatingOn$.next({
                                item: i.toSimpleInventoryItem(),
                                action: 'Move to ' + target.label
                            });
                            try {
                                let success;
                                if (i.postmaster === true) {
                                    const owner = i.owner.getValue();
                                    success = await this.transfer(player, i, owner, vaultStatus, progressTracker$);
                                    if (success) {
                                        if (owner.id === target.characterId) {
                                            moved++;
                                            continue;
                                        }
                                    }
                                }
                                success = await this.transfer(player, i, target, vaultStatus, progressTracker$);
                                if (success) {
                                    moved++;
                                    incrementalWork++;
                                }
                            } catch (e) {
                                this._operatingOn$.next({
                                    item: i.toSimpleInventoryItem(),
                                    action: 'Move to ' + target.label,
                                    error: true
                                });
                                console.log('Error on move: ' + e);
                            }
                        }
                    }
                }
            }
        }
        const msg = 'Moved ' + moved + ' items to ' + target.label;
        // re sync locks to work around bungie bug where things get locked
        await this.processGearLocks(player);
        this._operatingOn$.next(null);
        if (!invClearedSuccessfully) {
            return 'There were problems clear your non-junk gear. Be careful sharding things. If you have space, try moving some items to other characters to free up some space. Despite all that: ' + msg;
        } else if (vaultStatus.isFull) {
            return 'Your vault was too full to finish. Despite all that: ' + msg;
        } else if (moved == 0) {
            return 'Nothing left to shard!';
        } else {
            return 'Done! All set to start sharding! ' + msg;
        }
    }

    public findSimilarWeaponsNotByFrame(i: InventoryItem, player: Player, bySlot: boolean, byEnergy: boolean): InventoryItem[] {
        const copies = [i];
        for (const g of player.gear) {
            if (g.id == i.id) {
                continue;
            }
            if (i.type == ItemType.Weapon) {
                if (i.typeName != g.typeName) {
                    continue;
                }
                if (!bySlot || (g.inventoryBucket.displayProperties.name == i.inventoryBucket.displayProperties.name)) {
                    if (!byEnergy || (g.damageType == i.damageType)) {
                        copies.push(g);
                    }
                }
            }
        }
        return copies;
    }


    public findSimilarWeaponsByFrame(i: InventoryItem, player: Player, bySlot: boolean, byEnergy: boolean): InventoryItem[] {
        const copies = [i];
        for (const g of player.gear) {
            if (g.id == i.id) {
                continue;
            }
            if (i.type == ItemType.Weapon) {
                if (i.typeName != g.typeName) {
                    continue;
                }
                let iArchetype: string = null;
                let gArchetype = null;
                for (const s of i.sockets) {
                    if (s.socketCategoryHash == '3956125808' && s.plugs && s.plugs.length == 1) {
                        iArchetype = s.plugs[0].desc;
                        break;
                    }
                }
                for (const s of g.sockets) {
                    if (s.socketCategoryHash == '3956125808' && s.plugs && s.plugs.length == 1) {
                        gArchetype = s.plugs[0].desc;
                        break;
                    }
                }
                if (iArchetype && gArchetype && iArchetype == gArchetype) {
                    if (!bySlot || (g.inventoryBucket.displayProperties.name == i.inventoryBucket.displayProperties.name)) {
                        if (!byEnergy || (g.damageType == i.damageType)) {
                            copies.push(g);
                        }
                    }
                }
            }
        }
        return copies;
    }

    // finds armor of the same tier/class/slot and, optionally seasonal mod slot and energy type
    public findSimilarArmor(i: InventoryItem, player: Player, season?: boolean): InventoryItem[] {
        const copies = [i];
        // if (i.tier != 'Legendary') {
        //     return [];
        // }
        for (const g of player.gear) {
            if (g.id == i.id) {
                continue;
            }
            if (i.type == ItemType.Armor) {
                if (i.classAllowed != g.classAllowed) {
                    continue;
                }
                if (!i.inventoryBucket || !g.inventoryBucket) {
                    continue;
                }
                if (i.inventoryBucket.displayProperties.name != g.inventoryBucket.displayProperties.name) {
                    continue;
                }
                if (i.tier != g.tier) {
                    continue;
                }
                if (season) {
                    if (i.seasonalModSlot != g.seasonalModSlot) {
                        continue;
                    }
                }
                copies.push(g);
            }
        }
        return copies;
    }

    public static findCopies(i: InventoryItem, player: Player): InventoryItem[] {
        const copies = [i];
        for (const g of player.gear) {
            if (g.hash === i.hash && g.id != i.id) {
                copies.push(g);
            }
        }
        return copies;
    }

    public async bulkMove(player: Player, items: InventoryItem[], target: Target, progressTracker$: Subject<void>) {
        console.log('Moving ' + items.length + ' items.');
        const vaultStatus = { isFull: false };
        let successCnt = 0;
        for (const i of items) {
            try {
                if (target.id !== i.owner.getValue().id) {
                    this._operatingOn$.next({
                        item: i.toSimpleInventoryItem(),
                        action: 'Move to ' + target.label
                    });
                    this.notificationService.info('Moving ' + i.name + ' to ' + target.label);
                    const success = await this.transfer(player, i, target, vaultStatus, progressTracker$);
                    if (!success) {
                        console.log(`${i.name} could not be moved to ${target.label} b/c bucket was full.`);
                        this.notificationService.info(`${i.name} could not be moved to ${target.label} b/c target was full.`);
                        if (vaultStatus.isFull) {
                            this.notificationService.info(`Vault is full, ending prematurely`);
                            break;
                        }
                    } else {
                        successCnt++;
                    }
                } else if (i.postmaster) {
                    this.notificationService.info('Pulling ' + i.name + ' from postmaster.');
                    this._operatingOn$.next({
                        item: i.toSimpleInventoryItem(),
                        action: 'Pull from postmaster'
                    });
                    const success = await this.transfer(player, i, target, vaultStatus, progressTracker$);
                    if (!success) {
                        console.log(`${i.name} could not be moved to ${target.label} b/c bucket was full.`);
                        this.notificationService.info(`${i.name} could not be moved to ${target.label} b/c target was full.`);
                    } else {
                        successCnt++;
                    }

                }
            } catch (e) {
                // ignore
                console.log('Error moving ' + i.name + ': ' + e);
            }
        }
        this._operatingOn$.next(null);
        this.notificationService.info(`Done bulk move. Moved ${successCnt} / ${items.length} successfully.`);

    }

    public async clearInv(player: Player, progressTracker$: Subject<void>, itemType?: ItemType) {
        const target = player.characters[0];
        const vaultStatus = { isFull: false };
        const clearSuccess = await this.clearInvForMode(target, player, isKeepUpgradeUntagged, itemType, vaultStatus, progressTracker$);
        if (!clearSuccess) {
            this.notificationService.info('Inventory could not be fully cleared, your vault ran out of space');
        } else {
            this.notificationService.success('Inventory was cleared of all junk/infuse');
        }

    }

    public async weaponGrindMode(player: Player, progressTracker$: Subject<void>) {
        const itemType = ItemType.Weapon;
        const target = player.characters[0];
        let moved = 0;
        const vaultStatus = { isFull: false };

        this.clearInvForMode(target, player, isGrind, itemType, vaultStatus, progressTracker$);
        if (!vaultStatus.isFull) {
            console.log(`Grind mode cleared inv successfully.`);
        } else {
            console.log(`Grind mode encountered errors clearing inv.`);
        }
        for (const i of player.gear) {
            // is this worth targeting?
            if (isGrind(i)) {
                console.log(i.name);
                // is it not already where we need it
                if (i.owner.getValue().id != target.id && (itemType == null || i.type == itemType)) {
                    // is the vault full and required? If so, forget about it
                    if (vaultStatus.isFull && i.owner.getValue().id != player.vault.id) {
                        continue;
                    }
                    const targetBucket = this.bucketService.getBucket(target, i.inventoryBucket);
                    if (targetBucket.items.length < i.inventoryBucket.itemCount) {
                        console.log('Move ' + i.name + ' to ' + target.label + ' ' + targetBucket.desc.displayProperties.name);
                        try {
                            let success;
                            if (i.postmaster === true) {
                                const owner = i.owner.getValue();
                                this._operatingOn$.next({
                                    item: i.toSimpleInventoryItem(),
                                    action: 'Pull from Postmaster'
                                });
                                success = await this.transfer(player, i, owner, vaultStatus, progressTracker$);
                                if (success) {
                                    if (owner.id === target.characterId) {
                                        moved++;
                                        continue;
                                    }
                                }
                            }
                            this._operatingOn$.next({
                                item: i.toSimpleInventoryItem(),
                                action: 'Move to ' + target.label
                            });
                            success = await this.transfer(player, i, target, vaultStatus, progressTracker$);
                            if (success) {
                                moved++;
                            }
                        } catch (e) {
                            console.log('Error on move: ' + e);
                        }
                    }
                }
            }
        }
        const msg = 'Moved ' + moved + ' items to ' + target.label;
        // re sync locks to work around bungie bug where things get locked
        await this.processGearLocks(player);
        if (vaultStatus.isFull) {
            this.notificationService.success('Your vault was too full to finish. Despite all that: ' + msg);
        } else if (moved == 0) {
            this.notificationService.success('Nothing left to move!');
        } else {
            this.notificationService.success('Done! All set to start grinding! ' + msg);
        }
    }


    public async upgradeMode(player: Player, progressTracker$: Subject<void>, itemType?: ItemType): Promise<string> {
        const target = player.characters[0];
        const vaultStatus = { isFull: false };
        const clearSuccess = await this.clearInvForMode(target, player, isNeverTrue, itemType, vaultStatus, progressTracker$);
        let totalErr = 0;
        let moved = 0;
        for (const i of player.gear) {
            // is it marked for upgrade
            if (i.mark == 'upgrade' && (itemType == null || i.type == itemType)) {
                let copies = GearService.findCopies(i, player);
                copies = copies.filter(copy => copy.mark == 'infuse');
                copies = copies.filter(copy => copy.power > i.power);
                // nothing to infuse
                if (copies.length == 0) {
                    continue;
                }
                copies.push(i);
                console.dir(copies);
                
                copies = copies.filter(copy => (copy.owner.getValue().id != target.id || copy.postmaster));
                console.dir(copies);
                // nothing to infuse
                if (copies.length == 0) {
                    continue;
                }

                const targetBucket = this.bucketService.getBucket(target, i.inventoryBucket);
                if ((targetBucket.items.length + copies.length) <= i.inventoryBucket.itemCount) {
                    console.log('Move ' + i.name + ' to ' + target.label + ' ' + targetBucket.desc.displayProperties.name);
                    this.notificationService.info('Prepping ' + i.name + ' for upgrade (' + copies.length + ' total)');
                    for (const moveMe of copies) {
                        console.log('    From ' + moveMe.owner.getValue().label);
                        try {
                            let success = false;
                            let postMasterSuccess = true;
                            if (moveMe.postmaster === true) {
                                this._operatingOn$.next({
                                    item: moveMe.toSimpleInventoryItem(),
                                    action: 'Pull from Postmaster'
                                });
                                const owner = moveMe.owner.getValue();
                                postMasterSuccess = await this.transfer(player, moveMe, owner, { isFull: false }, progressTracker$);
                                if (owner.id === target.characterId) {
                                    continue;
                                }
                            }
                            if (postMasterSuccess && moveMe.owner.getValue().id != target.id) {
                                this._operatingOn$.next({
                                    item: moveMe.toSimpleInventoryItem(),
                                    action: 'Move to ' + target.label
                                });
                                success = await this.transfer(player, moveMe, target, { isFull: false }, progressTracker$);
                            }
                            if (success) {
                                moved++;
                            }
                        } catch (e) {
                            console.log('Couldn\'t move ' + moveMe.name);
                            this.notificationService.fail('Unable to move ' + moveMe.name + ' from ' + moveMe.owner.getValue().label + '. Nothing else to equip?');
                            totalErr++;
                        }
                    }

                }
            }
        }
        this._operatingOn$.next(null);
        const msg = 'Moved ' + moved + ' items to ' + target.label;

        // re sync locks to work around bungie bug where things get locked
        // await this.processGearLocks(player);

        if (totalErr > 0) {
            return 'There were ' + totalErr + ' problems moving your gear. Despite that: ' + msg;
        } else if (moved == 0) {
            return 'Nothing left to cheaply upgrade!';
        } else {
            return 'Done! All set to start upgrading! ' + msg;
        }
    }


    public async processGearLocks(player: Player, suppressNotifications?: boolean): Promise<void> {
        const gear = player.gear;
        let lockCnt = 0;
        let unlockedCnt = 0;
        let errCnt = 0;
        try {
            for (const i of gear) {
                if (i.mark == null) { continue; }
                if (i.mark == 'upgrade' || i.mark == 'keep' || i.mark == 'archive') {
                    if (i.locked.getValue() == false) {
                        try {
                            this._operatingOn$.next({
                                item: i.toSimpleInventoryItem(),
                                action: 'Locking'
                            });
                            await this.setLock(player, i, true);
                            if (!suppressNotifications) {
                                this.notificationService.info('Locked ' + i.name + ' on ' + i.owner.getValue().label);
                            }
                            lockCnt++;
                        } catch (e) {
                            this.notificationService.info('Failed to lock ' + i.name + ' on ' + i.owner.getValue().label);
                            errCnt++;
                        }
                    }
                } else if (i.mark == 'junk' || i.mark == 'infuse') {
                    if (i.locked.getValue() == true) {
                        try {
                            this._operatingOn$.next({
                                item: i.toSimpleInventoryItem(),
                                action: 'Unlocking'
                            });
                            await this.setLock(player, i, false);
                            if (!suppressNotifications) {
                                this.notificationService.info('Unlocked ' + i.name + ' on ' + i.owner.getValue().label);
                            }
                            unlockedCnt++;
                        } catch (e) {
                            this.notificationService.info('Failed to unlock ' + i.name + ' on ' + i.owner.getValue().label);
                            errCnt++;
                        }
                    }
                }
            }
        } finally {
            this._operatingOn$.next(null);
        }
        this.notificationService.info('Sync complete. Locked ' + lockCnt + ' items. Unlocked ' + unlockedCnt + ' items. ' + errCnt + ' errors.');
    }

    public async insertFreeSocketForWeaponPerk(item: InventoryItem, socket: InventorySocket, plug: InventoryPlug): Promise<boolean> {
        this.loading.next(true);

        try {
            const success = await this.bungieService.insertFreeSocket(this.signedOnUserService.player$.getValue(), item, socket, plug.hash);
            if (success) {
                if (socket.active) {
                    socket.active.active = false;
                }
                plug.active = true;
                socket.active = plug;
            }
            return success;
        } catch (x) {
            console.dir(x);
            const msg = getHttpErrorMsg(x);
            this.notificationService.fail(`Failed to insert socket: ${msg}`);
            // for testing
            // socket.active.active = false;
            // plug.active = true;
            // socket.active = plug;
            return false;
        }
        finally {
            this.loading.next(false);
        }
    }

    // insertFreeSocketForArmorMod  is just slotting a mod into a socket
    // "Free" means that it doesn't cost any currency, not like the bad old days
    public async insertFreeSocketForArmorMod(item: InventoryItem, socket: InventorySocket, plug: ManifestInventoryItem, previewOnly?: boolean): Promise<boolean> {

        const newPlug = new InventoryPlug(plug.hash + '', plug.displayProperties.name, plug.displayProperties.description, plug.displayProperties.icon, true, plug.plug?.energyCost, '', true, []);

        this.loading.next(true);
        try {
            let success = true;
            if (!previewOnly) {
                success = await this.bungieService.insertFreeSocket(this.signedOnUserService.player$.getValue(), item, socket, plug.hash + '');
            }
            if (success) {
                let newCost = plug.plug?.energyCost?.energyCost;
                if (!newCost) {
                    newCost = 0;
                }
                const activeCost = socket.active ? socket.active.energyCost : 0;
                socket.plugs = [newPlug];
                socket.active = newPlug;
                item.energyUsed = item.energyUsed - activeCost + newCost;
            }
            return success;
        } catch (x) {
            console.dir(x);
            const msg = getHttpErrorMsg(x);
            this.notificationService.fail(`Failed to insert socket: ${msg}`);
            return false;
        }
        finally {
            this.loading.next(false);
        }
    }


    public async fixPerks(fixMe: InventoryItem[], log$: BehaviorSubject<string[]>): Promise<void> {
        const log = [];
        log$.next(log);
        for (const i of fixMe) {
            this.notificationService.info('Fixing ' + i.name);
            const perkSockets = i.sockets.filter(s => s.isWeaponPerk);
            for (const s of perkSockets) {
                const socketNeedsFixing = PandaGodrollsService.isFixNeeded(s);
                if (!socketNeedsFixing) {
                    continue;
                }
                let bestPlug = s.plugs[0];
                for (const p of s.plugs) {
                    if (p.getPandaRating() > bestPlug.getPandaRating()) {
                        bestPlug = p;
                    }
                }
                const logMsg = `Inserting ${bestPlug.name} into ${i.name}`;
                log.push(logMsg);
                log$.next(log);
                console.log(`Best plug for ${i.name} is ${bestPlug.name}`);
                await this.insertFreeSocketForWeaponPerk(i, s, bestPlug);
                await sleep(500);
            }
            // remove 'is:fixme' from search
            i.searchText = i.searchText.replace('is:fixme', '');
        }
    }

    public async transfer(player: Player, itm: InventoryItem, target: Target, vaultStatus: VaultStatus, progressTracker$?: Subject<void>, tryHard?: boolean): Promise<boolean> {
        try {
            this.loading.next(true);

            // equip something else from our bucket, if we can
            if (itm.equipped.getValue() == true) {
                let equipMe: InventoryItem = this.bucketService.getBucket(itm.owner.getValue(), itm.inventoryBucket).otherItem(itm);
                if (equipMe == null) {
                    // grab something from the vault
                    const vaultItem: InventoryItem = this.bucketService.getBucket(player.vault, itm.inventoryBucket).otherItem(itm);
                    if (vaultItem == null) {
                        throw new Error('Nothing to equip to replace ' + itm.name);
                    }
                    // transfer to source player
                    const success = await this.transfer(player, vaultItem, itm.owner.getValue(), vaultStatus);
                    if (!success) {
                        return false;
                    }
                    // get a reference to it now that it's on that other player
                    equipMe = this.bucketService.getBucket(itm.owner.getValue(), itm.inventoryBucket).otherItem(itm);
                    if (equipMe == null) {
                        throw new Error('2) Nothing to equip to replace ' + itm.name);
                    }
                }
                console.log(itm.name + ' was equipped. Equipping ' + equipMe.name + ' in its place.');
                const equipSuccess = await this.equip(player, equipMe);
                if (!equipSuccess) {
                    throw new Error(('Could not equip ' + equipMe.name + ' on ' + equipMe.owner.getValue().label));
                }
            }

            // if the target is the vault, we just need to put it there
            if (target.id == BUCKET_ID_VAULT) {
                let owner = itm.owner.getValue();
                if (owner == player.shared) {
                    owner = player.characters[0];
                }

                const success = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                    owner, itm, true, player.vault, this.bucketService);
                if (!success) {
                    vaultStatus.isFull = true;
                    return false;
                } else {
                    vaultStatus.isFull = false;
                }
                itm.options.push(itm.owner.getValue());
                itm.owner.next(player.vault);
                itm.options.splice(itm.options.indexOf(itm.owner.getValue()), 1);

            } else if (itm.owner.getValue().id == BUCKET_ID_VAULT || itm.postmaster) {
                let tempTarget = target;
                if (target == player.shared) {
                    tempTarget = player.characters[0];
                }
                const success = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                    tempTarget, itm, false, player.vault, this.bucketService, itm.postmaster);
                if (!success && tryHard) {
                    // if our bucket was full and we're trying hard, try to move an item to the vault
                    const bucket = this.bucketService.getBucket(tempTarget, itm.inventoryBucket);
                    const toVault: InventoryItem = bucket.otherItem(bucket.equipped);
                    console.log(`Moving ${toVault.name} to the vault to make space for initial transfer of ${itm.name}`);
                    const makeSpaceSuccess = await this.transfer(player, toVault, player.vault, vaultStatus);
                    // if we fail, we're done
                    if (!makeSpaceSuccess) {
                        return false;
                    } else {
                        // if we succeed, try the original item again
                        const tryAgainSuccess = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                            tempTarget, itm, false, player.vault, this.bucketService, itm.postmaster);
                        if (!tryAgainSuccess) {
                            return false;
                        }
                    }
                } else if (!success) {
                    return false;
                }
                if (itm.postmaster === true) {
                    itm.postmaster = false;
                } else {
                    itm.options.push(itm.owner.getValue());
                    itm.owner.next(target);
                    itm.options.splice(itm.options.indexOf(itm.owner.getValue()), 1);
                }

            } else {
                // this needs to go through the vault to get to the other player
                let success = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                    itm.owner.getValue(), itm, true, player.vault, this.bucketService);
                if (!success) {
                    vaultStatus.isFull = true;
                    return false;
                } else {
                    vaultStatus.isFull = false;
                }
                itm.options.push(itm.owner.getValue());
                itm.owner.next(player.vault);
                itm.options.splice(itm.options.indexOf(itm.owner.getValue()), 1);

                success = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                    target, itm, false, player.vault, this.bucketService);
                // if our bucket was full and we're trying hard, try to move an item to the vault
                if (!success && tryHard) {
                    const bucket = this.bucketService.getBucket(target, itm.inventoryBucket);
                    const toVault: InventoryItem = bucket.otherItem(bucket.equipped);
                    console.log(`Moving ${toVault.name} to the vault to make space for initial transfer of ${itm.name}`);
                    const makeSpaceSuccess = await this.transfer(player, toVault, player.vault, vaultStatus);
                    // if we fail, we're done
                    if (!makeSpaceSuccess) {
                        return false;
                    } else {
                        // if we succeed, try the original item again
                        const tryAgainSuccess = await this.bungieService.transfer(player.profile.userInfo.membershipType,
                            target, itm, false, player.vault, this.bucketService, itm.postmaster);
                        if (!tryAgainSuccess) {
                            return false;
                        }
                    }
                } else if (!success) {
                    return false;
                }
                itm.options.push(itm.owner.getValue());
                itm.owner.next(target);
                itm.options.splice(itm.options.indexOf(itm.owner.getValue()), 1);
            }
            if (progressTracker$ != null) {
                progressTracker$.next();
            }
            return true;
        }
        finally {
            this.canEquip(itm);
            this.loading.next(false);
        }
    }

    public async setLock(player: Player, itm: InventoryItem, locked: boolean): Promise<boolean> {
        try {
            this.loading.next(true);
            let owner;
            if (itm.owner.getValue() == player.vault || itm.owner.getValue() == player.shared) {
                owner = player.characters[0];
            } else {
                owner = itm.owner.getValue();
            }
            const success = await this.bungieService.setLock(player.profile.userInfo.membershipType, owner.id, itm, locked);
            if (success === true) {
                itm.locked.next(locked);
                return true;
            }
            return false;
        }
        finally {
            this.loading.next(false);
        }
    }

    public async equip(player: Player, itm: InventoryItem): Promise<boolean> {
        try {
            this.loading.next(true);
            const success = await this.bungieService.equip(player.profile.userInfo.membershipType, itm);
            if (success === true) {
                const bucket: Bucket = this.bucketService.getBucket(itm.owner.getValue(), itm.inventoryBucket);
                const oldEquipped = bucket.equipped;
                oldEquipped.equipped.next(false);
                bucket.equipped = itm;
                itm.equipped.next(true);
                this.canEquip(itm);
                this.canEquip(oldEquipped);
                return true;
            }
            return false;
        }
        finally {
            this.loading.next(false);
        }
    }
}


