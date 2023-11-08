import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconService } from '@app/service/icon.service';
import { InventoryPlug } from '@app/service/model';
import { NotificationService } from '@app/service/notification.service';
import { ClipboardService } from 'ngx-clipboard';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';



// my-custom-tooltip.component.ts

@Component({
  selector: 'app-my-custom-tooltip',
  template: `<div>This is a custom tooltip with <strong>HTML</strong> content!</div>`,
  styles: [`div { background-color: #eee; padding: 10px; border-radius: 4px; }`]
})
export class MyCustomTooltipComponent {}


// regular stuff

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'd2c-god-roll-plug',
  templateUrl: './god-roll-plug.component.html',
  styleUrls: ['./god-roll-plug.component.scss']
})
export class GodRollPlugComponent {

  @Input() plug: InventoryPlug;

  @Input() debugmode: boolean;
  
  @Input() currentLevel: number|null;

  private overlayRef: OverlayRef;

  constructor(
    public iconService: IconService,
    private clipboardService: ClipboardService,
    private notificationService: NotificationService,
    private overlay: Overlay 
    //private renderer: Renderer2
    ) { }


  copyToClipboard() {
    this.clipboardService.copyFromContent(this.plug.hash);
    this.notificationService.success('Copied ' + this.plug.name + ' to clipboard');
  }

  showTooltip() {
    const positionStrategy = this.overlay.position()
      .global()
      .centerHorizontally()
      .centerVertically(); // You'd normally position this relative to the triggering element

    this.overlayRef = this.overlay.create({
      positionStrategy,
    });

    const customTooltipPortal = new ComponentPortal(MyCustomTooltipComponent);
    this.overlayRef.attach(customTooltipPortal);
  }

  hideTooltip() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }
  }

}

