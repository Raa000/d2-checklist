import { ChangeDetectionStrategy, Component, Input, OnInit, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material';
import { TriumphNode } from '@app/service/model';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Observable, of as observableOf, Subject, BehaviorSubject } from 'rxjs';
import { ChildComponent } from '@app/shared/child.component';
import { StorageService } from '@app/service/storage.service';
import { TriumphFlatNode } from '../triumphs/triumphs.component';

@Component({
  selector: 'anms-collections',
  templateUrl: './collections.component.html',
  styleUrls: ['./collections.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsComponent extends ChildComponent implements OnInit {

  @Input() selectedTab: string;

  @Input() selectedTreeNodeHash: string;

  @Input()
  set collections(arg: TriumphNode[]) {
    this._collections = arg;
    this.init();
  }

  @Output() nodeClicked = new EventEmitter<string>();

  collectionDatasource: MatTreeFlatDataSource<any, TriumphFlatNode>;
  collectionTreeControl: FlatTreeControl<any>;
  treeFlattener2: MatTreeFlattener<TriumphNode, TriumphFlatNode>;
  hideComplete = false;

  private _collections: TriumphNode[] = [];

  constructor(
    storageService: StorageService,
    private ref: ChangeDetectorRef) {
    super(storageService, ref);
    this.collectionTreeControl = new FlatTreeControl<TriumphFlatNode>(this._getLevel, this._isExpandable);
    this.treeFlattener2 = new MatTreeFlattener(this.transformer2, this._getLevel, this._isExpandable, this._getChildren);
    this.hideComplete = localStorage.getItem('hide-completed-collections') === 'true';

  }

  private init() {
    this.collectionDatasource = new MatTreeFlatDataSource(this.collectionTreeControl, this.treeFlattener2);
    this.collectionDatasource.data = this._collections;
    if (this.selectedTab === 'collections') {
      if (this.selectedTreeNodeHash != null) {
        for (const n of this.collectionTreeControl.dataNodes) {
          if (n.data.hash === +this.selectedTreeNodeHash) {
            this.collectionTreeControl.expand(n);
            this.expandParents(this.collectionTreeControl, n);
            break;
          }
        }
      }
    }
  }
  public hideCompleteChange() {
    localStorage.setItem('hide-completed-collections', '' + this.hideComplete);
  }


  private getParentNode(tree: FlatTreeControl<any>, node: TriumphFlatNode): TriumphFlatNode {
    const currentLevel = tree.getLevel(node);
    if (currentLevel < 1) {
      return null;
    }
    const startIndex = tree.dataNodes.indexOf(node) - 1;
    for (let i = startIndex; i >= 0; i--) {
      const currentNode = tree.dataNodes[i];
      if (tree.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
  }

  private expandParents(tree: FlatTreeControl<any>, node: TriumphFlatNode): void {
    const parent = this.getParentNode(tree, node);
    tree.expand(parent);
    if (parent && parent.level > 0) {
      this.expandParents(tree, parent);
    }
  }

  transformer2 = (node: TriumphNode, level: number) => {
    return new TriumphFlatNode(!!node.children, level, node, true);
  }

  private _getLevel = (node: TriumphFlatNode) => node.level;

  private _isExpandable = (node: TriumphFlatNode) => node.expandable;

  private _getChildren = (node: any): Observable<any[]> => observableOf(node.children);

  hasChild = (_: number, _nodeData: TriumphFlatNode) => _nodeData.expandable;

  hideNode = (_nodeData: TriumphFlatNode) => this.hideComplete && _nodeData.data.complete;

  ngOnInit() {
  }

}
