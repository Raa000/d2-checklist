import { ChangeDetectionStrategy, Component, Input, ElementRef, ViewChild } from '@angular/core';
import { IconService } from '@app/service/icon.service';
import { InventoryPlug } from '@app/service/model';
import { NotificationService } from '@app/service/notification.service';
import { ClipboardService } from 'ngx-clipboard';
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';



// my-custom-tooltip.component.ts

@Component({
  selector: 'app-my-custom-tooltip',
  templateUrl: './../clarity-overlay/clarity-overlay.component.html',
  styleUrls: ['./god-roll-plug.component.scss']
})
export class MyCustomTooltipComponent 
{
  @Input() plugData: InventoryPlug; 
}


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

  @ViewChild('tooltipTrigger', { static: true }) tooltipTrigger: ElementRef;

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

  showTooltip(origin: ElementRef, plugIn: InventoryPlug) {

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(origin)
      .withPositions([
        {
          originX: 'start',
          originY: 'center',
          overlayX: 'end',
          overlayY: 'center',
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: false
    });

    const customTooltipPortal = new ComponentPortal(MyCustomTooltipComponent);
    const tooltipInstance = this.overlayRef.attach(customTooltipPortal);
    tooltipInstance.instance.plugData = plugIn;
  }

  hideTooltip() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }
  }

}

